/**
 * Remote connection between JavaScript & Unreal Engine.
 * Keep this module generic, do not import 'vscode' here!
 */

import * as dgram from 'dgram';
import * as uuid from 'uuid';
import * as net from 'net';


const PROTOCOL_VERSION = 1;      // Protocol version number
const PROTOCOL_MAGIC = 'ue_py';  // Protocol magic identifier


/** Struct containing all the different output types */
export class FCommandOutputType {
    static readonly info = "Info";
    static readonly warning = "Warning";
    static readonly error = "Error";
}


/** Struct containing the different execution modes */
export class FExecMode {
    static readonly execFile = 'ExecuteFile';               // Execute the Python command as a file. This allows you to execute either a literal Python script containing multiple statements, or a file with optional arguments
    static readonly execStatement = 'ExecuteStatement';     // Execute the Python command as a single statement. This will execute a single statement and print the result. This mode cannot run files
    static readonly evalStatement = 'EvaluateStatement';
}


/** struct containing the different command types */
export class FCommandTypes {
    static readonly ping = "ping";                          // Service discovery request (UDP)
    static readonly pong = "pong";                          // Service discovery response (UDP)
    static readonly openConnection = "open_connection";     // Open a TCP command connection with the requested server (UDP)
    static readonly closeConnection = "close_connection";   // Close any active TCP command connection (UDP)
    static readonly command = "command";                    // Execute a remote Python command (TCP)
    static readonly commandResults = "command_result";      // Result of executing a remote Python command (TCP)
}


/**
 * Configurations for the remote server / connection
 */
export class RemoteExecutionConfig {
    multicastTTL: number;
    multicastGroupEndpoint: [string, number];
    multicastBindAddress: string;
    commandEndpoint: [string, number];

    /**
     * @param multicastTTL (0 is limited to the local host, 1 is limited to the local subnet)
     * @param multicastGroupEndpoint The multicast group endpoint tuple that the UDP multicast socket should join (must match the "Multicast Group Endpoint" setting in the Python plugin)
     * @param multicastBindAddress The adapter address that the UDP multicast socket should bind to, or 0.0.0.0 to bind to all adapters (must match the "Multicast Bind Address" setting in the Python plugin)
     * @param commandEndpoint The endpoint tuple for the TCP command connection hosted by this client (that the remote client will connect to)
     */
    constructor
        (
            multicastTTL = 0,
            multicastGroupEndpoint = "239.0.0.1:6766",
            multicastBindAddress = "0.0.0.0",
            commandEndpoint = "127.0.0.1:6776"
        ) {
        this.multicastTTL = multicastTTL;
        this.multicastBindAddress = multicastBindAddress;

        // Split `multicastGroupEndpoint` & `commandEndpoint` into an array with [IP, PORT]
        const multicastGroupEndpointTuple = multicastGroupEndpoint.split(":", 2);
        this.multicastGroupEndpoint = [multicastGroupEndpointTuple[0], Number(multicastGroupEndpointTuple[1])];

        const commandEndpointTuple = commandEndpoint.split(":", 2);
        this.commandEndpoint = [commandEndpointTuple[0], Number(commandEndpointTuple[1])];
    }
}


/**
 * Run the function `check` as many times as provided in `itterations`. But wait `interval` seconds between each run.
 * @param itterations How many times to run the 'check' function before returning false.
 * @param interval Seconds to wait between each itteration
 * @param check The function to check, function must return a boolean
 * @returns True whenever the test function returns true, otherwise false if it times out.
 */
async function timeoutCheck(itterations = 10, interval = 1, check: () => boolean) {
    const sleep = (seconds: number) => {
        return new Promise((resolve, reject) => {
            setTimeout(resolve, (seconds * 1000));
        });
    };

    let i = 0;
    while (i < itterations) {
        await sleep(interval);
        if (check()) {
            return true;
        }
        i++;
    }

    return false;
}


/**
 * The main class that should be initialized when you want to connect to Unreal Engine
 */
export class RemoteConnection {
    private config: RemoteExecutionConfig;
    private nodeId: string;
    private broadcastSocket: BroadcastSocket | null = null;

    /**
     * @param config Configurations for the connection / server
     */
    constructor(config = new RemoteExecutionConfig()) {
        this.config = config;
        this.nodeId = uuid.v4();
    }

    /** Check if `start()` already has been requested, this does not mean that the server and all sockets has fully started yet. */
    public hasStartBeenRequested() {
        return this.broadcastSocket !== null;
    }

    /**
     * Start a connection with the server
     * @param callback Function to call once a connection has been established. If it failed to connect function will be called with an error.
     * @param timeout Number of seconds to wait before timing out
     */
    public start(callback?: (error?: Error) => void, timeout = 2) {
        this.broadcastSocket = new BroadcastSocket(this.config, this.nodeId);

        this.broadcastSocket.start(error => {
            if (error) {
                this.stop();
            }
            else {
                this.broadcastSocket?.onCommandSocket("close", () => { this.onLostConnection(); });
            }

            if (callback) {
                callback(error);
            }
        }, timeout);

    }

    /**
     * Close the remote connection
     * @param callback Function to call once connection has been closed, will be called with an Error if something went wrong
     */
    public stop(callback?: (error?: Error) => void) {
        if (this.broadcastSocket) {
            this.broadcastSocket.close(callback);
        }

        this.broadcastSocket = null;
    }

    /**
     * Send a python command to the remote execution server
     * @param command The python command as a executable string
     * @param callback The function to call with the response from Unreal Engine
     * @param bUnattended
     * @param execMode Tell Unreal how the command should be executed
     * @param bRaiseOnFailure
     */
    public async runCommand(command: string, callback?: (message: RemoteExecutionMessage) => void, bUnattended = true, execMode = FExecMode.execStatement, bRaiseOnFailure = false) {
        if (!this.broadcastSocket) {
            // If start hasn't manually been requested, start the broadcast socket and re-run this function
            this.start(error => {
                if (!error) {
                    this.runCommand(command, callback, bUnattended, execMode, bRaiseOnFailure);
                }
            });

            return;
        }

        // If broadcast socket isn't running yet, wait a few sec for it to start
        if (!this.broadcastSocket.isRunning()) {
            if (!(await timeoutCheck(25, 0.2, this.broadcastSocket.isRunning))) {
                return false;
            }
        }

        // Construct a `RemoteExecutionMessage` and pass it along to the broadcast socket
        const message = new RemoteExecutionMessage(FCommandTypes.command, this.nodeId, null, {
            'command': command,
            'unattended': bUnattended,
            'exec_mode': execMode,  /* eslint-disable-line  @typescript-eslint/naming-convention */
        });

        return this.broadcastSocket.sendMessage(message, callback);
    }

    private onLostConnection() {
        this.stop();
    }
}


/**
 * The broadcast socket created by the `RemoteConnection`
 */
class BroadcastSocket {
    private bIsRunning = false;;
    private socket;
    private nodeId;
    private config;
    private commandServer: CommandServer | null = null;

    private startCallback?: ((error?: Error) => void);
    private startTimeout = 0;

    /**
     * @param config Configurations for the connection / server
     * @param nodeId The unique node ID, must be the same as the one in `RemoteConnection`
     */
    constructor(config: RemoteExecutionConfig = new RemoteExecutionConfig(), nodeId: string) {
        this.nodeId = nodeId;
        this.config = config;
        this.socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    }

    /**
     * Bind a function to the command socket
     * @param event The event to bind to
     * @param listener The function to call when the event is fired
     */
    public onCommandSocket(event: 'close', listener: Function) {
        if (this.commandServer) {
            this.commandServer.onSocket(event, listener);
        }
    }

    /** Check if this `BroadcastSocket` has started & is listening */
    public isRunning() {
        return this.bIsRunning;
    }

    /** Is command server running */
    public isCommandServerRunning() {
        return this.bIsRunning && this.commandServer && this.commandServer.isRunning();
    }

    /**
     * Start the broadcast socket
     * @param callback Function to call once the `CommandSocket` has fully started
     * @param timeout Number of seconds to wait before timing out
     */
    public start(callback?: (error?: Error) => void, timeout = 2) {
        this.startCallback = callback;
        this.startTimeout = timeout;

        // Hook up events
        this.socket.on('listening', () => this.onListening());
        this.socket.on('message', (message: Buffer, remote: dgram.RemoteInfo) => this.onMessage(message, remote));
        this.socket.on('error', err => this.onError(err));
        this.socket.on('close', this.onClose);

        this.socket.bind({
            address: this.config.multicastBindAddress,
            port: this.config.multicastGroupEndpoint[1]
        });
    }

    public close(callback?: (error?: Error) => void) {
        if (this.socket) {
            // Broadcast a close connection message
            const message = new RemoteExecutionMessage(FCommandTypes.closeConnection, this.nodeId, null);
            this.socket.send(message.toJsonString(),
                this.config.multicastGroupEndpoint[1],
                this.config.multicastGroupEndpoint[0],
                (error: Error | null, bytes: number) => {
                    this._close(callback);
                });
        }
        else {
            this._close(callback);
        }
    }

    private _close(callback?: (error?: Error) => void) {
        if (this.commandServer) {
            this.commandServer.close((error?: Error) => {
                this.socket.close(callback);
            });
        }
        else if (this.socket) {
            this.socket.close(callback);
        }
        else if (callback) {
            callback();
        }
    }

    private onClose() {
        this.bIsRunning = false;
    }

    private onConnect(err: Error | null, bytes: number) {
        if (err) {
            throw err;
        }
    }

    private onListening() {
        this.socket.setMulticastLoopback(true);
        this.socket.setMulticastTTL(this.config.multicastTTL);
        this.socket.setMulticastInterface(this.config.multicastBindAddress);
        this.socket.addMembership(this.config.multicastGroupEndpoint[0]);

        this.bIsRunning = true;

        this._openCommandServer();
    }

    private onMessage(message: Buffer, remote: dgram.RemoteInfo) {
        const remoteMessage = RemoteExecutionMessage.fromBuffer(message);

        if (remoteMessage.type === FCommandTypes.openConnection) {
            this.commandServer = new CommandServer(this.nodeId, this.config);
            this.commandServer.start(this.startCallback, this.startTimeout);
        }
    }

    private onError(err: Error) {
    }

    private _openCommandServer() {
        const message = new RemoteExecutionMessage(FCommandTypes.openConnection, this.nodeId, null, {
            'command_ip': this.config.commandEndpoint[0],  /* eslint-disable-line  @typescript-eslint/naming-convention */
            'command_port': this.config.commandEndpoint[1],  /* eslint-disable-line @typescript-eslint/naming-convention */
        });

        this.socket.send(message.toJsonString(), this.config.multicastGroupEndpoint[1], this.config.multicastGroupEndpoint[0], this.onConnect);
    }

    public sendMessage(message: RemoteExecutionMessage, callback?: (message: RemoteExecutionMessage) => void) {
        if (!this.commandServer) {
            throw Error("Command server has not been started yet!");
        }

        return this.commandServer.sendMessage(message, callback);
    }
}


class CommandServer {
    private server;
    private config;
    private nodeId;
    private startTimeout?: number;
    private commandSocket: CommandSocket | undefined;
    private startCallback?: (error?: Error) => void;

    private bIsRunning = false;

    private onSocketClosedEvents: Function[] = [];

    constructor(nodeId: string, config = new RemoteExecutionConfig()) {
        this.server = net.createServer();
        this.config = config;
        this.nodeId = nodeId;
    }

    public onSocket(event: "close", listener: Function) {
        if (event === "close") {
            this.onSocketClosedEvents.push(listener);
        }
    }

    public isRunning() {
        return this.bIsRunning;
    }

    public start(cb?: ((error?: Error) => void), timeout = 2) {
        // console.log("Starting CommandServer...");

        this.startTimeout = timeout;

        this.startCallback = cb;

        this.server.on('error', this.onError);
        this.server.on('listening', () => { this.onListening(); });
        this.server.on('connection', (socket: net.Socket) => this.onConnection(socket));
        this.server.on('close', this.onClose);

        this.server.listen(this.config.commandEndpoint[1], this.config.commandEndpoint[0]);
    }

    public sendMessage(message: RemoteExecutionMessage, callback?: (message: RemoteExecutionMessage) => void) {
        if (this.commandSocket) {
            this.commandSocket.write(message.toJsonString(), callback);
        }
    }

    public close(callback?: ((err?: Error) => void)) {
        if (this.isRunning() && this.commandSocket) {
            this.commandSocket.close(() => {
                if (this.server) {
                    this.server.close(callback);
                }
            });
        }
        else {
            if (this.server) {
                this.server.close(callback);
            }
            else if (callback) {
                callback();
            }
        }
    }

    private async onListening() {
        if (this.startTimeout) {
            setTimeout(() => {
                if (!this.bIsRunning) {
                    this.onTimeout();
                }
            }, this.startTimeout * 1000);
        }
    }

    private onConnection(socket: net.Socket) {
        this.commandSocket = new CommandSocket(socket);
        this.commandSocket.socket.on('close', (bHadError: boolean) => { this.onSocketClosed(bHadError); });

        if (this.startCallback) {
            this.startCallback();
        }

        this.bIsRunning = true;
    }

    private onTimeout() {
        this.close();
        if (this.startCallback) {
            const error = new Error("Timed out while trying to connect to Unreal Engine.");
            this.startCallback(error);
        }
    }

    private onClose() {
        this.bIsRunning = false;
    }

    private onSocketClosed(bHadError: boolean) {
        for (const callback of this.onSocketClosedEvents) {
            callback();
        }
    }

    private onError(err: Error) {
        throw err;
    }


}


class CommandSocket {
    socket;

    private bIsWriting = false;

    private commandQue: any = [];

    private callbacks: (Function | undefined)[] = [];

    constructor(socket: net.Socket) {
        this.socket = socket;

        this.socket.on('error', this.onError);
        this.socket.on('data', (data: Buffer) => { this.onData(data); });
        this.socket.on('close', this.onClose);
    }

    public close(cb?: (() => void)) {
        this.socket.end(cb);
    }

    public write(buffer: string | Uint8Array, callback?: (message: RemoteExecutionMessage) => void) {
        if (this.bIsWriting) {
            this.queCommand(buffer, callback);
            return;
        }

        this.bIsWriting = true;
        this.callbacks.push(callback);

        return this._write(buffer);
    }

    private onClose() {
    }

    private onData(data: Buffer) {
        const callback = this.callbacks.shift();
        if (callback) {
            const message = RemoteExecutionMessage.fromBuffer(data);
            callback(message);
        }

        this.handleNextCommandInQue();
    }

    private onError(err: Error) {
        // console.log("Error:" + err);
    }

    private _write(buffer: string | Uint8Array, cb?: (err?: Error | undefined) => void) {
        return this.socket.write(buffer, cb);
    }

    private queCommand(buffer: string | Uint8Array, callback?: Function) {
        this.commandQue.push([buffer, callback]);
    }

    private handleNextCommandInQue() {
        if (this.commandQue.length > 0) {
            const command = this.commandQue.shift();
            const buffer = command[0];
            const callback = command[1];
            this.callbacks.push(callback);

            this._write(buffer);
        }
        else {
            // If command que is empty, set writing to false
            this.bIsWriting = false;
        }
    }

}


export class RemoteExecutionMessage {
    readonly type;
    readonly source;
    readonly dest;
    readonly data;

    /**
     * A message sent or received by remote execution (on either the UDP or TCP connection), as UTF-8 encoded JSON.
     * @param type The type of this message (see the `_TYPE_` constants).
     * @param source The ID of the node that sent this message.
     * @param dest The ID of the destination node of this message, or None to send to all nodes (for UDP broadcast).
     * @param data The message specific payload data.
     */
    constructor(type: string, source: string, dest: string | null = null, data: any = {}) {
        this.type = type;
        this.source = source;
        this.dest = dest;
        this.data = data;
    }


    /**
     *  Test to see whether this message should be received by the current node (wasn't sent to itself, and has a compatible destination ID).
     * @param nodeId The ID of the local "node" (this session).
     * @return:True if this message should be received by the current node, False otherwise.
     */
    public passesReceiveFilter(nodeId: string) {
        return this.source !== nodeId && (!this.dest || this.dest === nodeId);
    }


    /**
     * Convert this message to its JSON representation.
     */
    public toJsonString() {
        if (!this.type) {
            throw Error('"type" cannot be empty!');
        }

        if (!this.source) {
            throw Error('"source" cannot be empty!');
        }

        let jsonObj: any = {
            'version': PROTOCOL_VERSION,
            'magic': PROTOCOL_MAGIC,
            'type': this.type,
            'source': this.source,
        };

        if (this.dest) {
            jsonObj['dest'] = this.dest;
        }
        if (this.data) {
            jsonObj['data'] = this.data;
        }

        return JSON.stringify(jsonObj);
    }

    public getCommandResultOutput() {
        if (this.type === FCommandTypes.commandResults) {
            const outputs: [{ type: string, output: string }] = this.data.output;
            return outputs;
        }
        return [];
    }

    static fromJson(jsonData: any) {
        if (jsonData['version'] !== PROTOCOL_VERSION) {
            throw Error(`"version" is incorrect (got ${jsonData['version']}, expected ${PROTOCOL_VERSION})!`);
        }
        if (jsonData['magic'] !== PROTOCOL_MAGIC) {
            throw Error(`"magic" is incorrect (got ${jsonData['magic']}, expected ${PROTOCOL_MAGIC})!`);
        }

        const type = jsonData['type'];
        const source = jsonData['source'];
        const dest = jsonData['dest'];
        const data = jsonData['data'];

        return new RemoteExecutionMessage(type, source, dest, data);
    }

    static fromBuffer(buffer: Buffer) {
        const jsonString = buffer.toString();
        const jsonData = JSON.parse(jsonString);
        return this.fromJson(jsonData);
    }
}