/**
 * Remote connection between TypeScript & Unreal Engine.
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
        this.socket.on('error', error => this.onError(error));
        this.socket.on('close', this.onClose);

        this.socket.bind({
            address: this.config.multicastBindAddress,
            port: this.config.multicastGroupEndpoint[1]
        });
    }

    /**
     * Pass along a message to the command server that will be sent to Unreal
     * @param message The message to pass along
     * @param callback Function to call with the response from the server
     */
    public sendMessage(message: RemoteExecutionMessage, callback?: (message: RemoteExecutionMessage) => void) {
        if (!this.commandServer) {
            throw Error("Command server has not been started yet!");
        }

        return this.commandServer.sendMessage(message, callback);
    }

    /**
     * Close the broadcast socket, this will emit a close connection message
     * @param callback Function to call once socket has been closed.
     */
    public close(callback?: (error?: Error) => void) {
        if (this.socket) {
            // Broadcast a close connection message
            const message = new RemoteExecutionMessage(FCommandTypes.closeConnection, this.nodeId, null);
            this.socket.send(message.toJsonString(),
                this.config.multicastGroupEndpoint[1],
                this.config.multicastGroupEndpoint[0],
                (error, bytes) => {
                    this.closeCommandServerAndSocket(callback);
                });
        }
        else {
            this.closeCommandServerAndSocket(callback);
        }
    }

    /**
     * Close the CommandServer & this socket after 
     */
    private closeCommandServerAndSocket(callback?: (error?: Error) => void) {
        if (this.commandServer) {
            this.commandServer.close(error => {
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

    /** Function is bound to 'listening' on the broadcast socket, called when it first starts listening */
    private onListening() {
        // Setup some configs
        this.socket.setMulticastLoopback(true);
        this.socket.setMulticastTTL(this.config.multicastTTL);
        this.socket.setMulticastInterface(this.config.multicastBindAddress);
        this.socket.addMembership(this.config.multicastGroupEndpoint[0]);

        this.bIsRunning = true;  // This socket is now up and runnnig

        // Send a openConnection message to start the command server
        const message = new RemoteExecutionMessage(FCommandTypes.openConnection, this.nodeId, null, {
            'command_ip': this.config.commandEndpoint[0],  /* eslint-disable-line  @typescript-eslint/naming-convention */
            'command_port': this.config.commandEndpoint[1],  /* eslint-disable-line @typescript-eslint/naming-convention */
        });

        this.socket.send(
            message.toJsonString(),
            this.config.multicastGroupEndpoint[1],
            this.config.multicastGroupEndpoint[0],
            (error, bytes) => {
                if (error) {
                    throw error;
                }
            }
        );
    }

    /** Function is bound to 'message' on the broadcast socket, called whenever a message is recived */
    private onMessage(message: Buffer, remote: dgram.RemoteInfo) {
        const remoteMessage = RemoteExecutionMessage.fromBuffer(message);

        // Check if the message was meant for this node
        if (remoteMessage.source !== this.nodeId) {
            return;
        }

        // If the message recived was an "open connection", start the command server
        if (remoteMessage.type === FCommandTypes.openConnection) {
            this.commandServer = new CommandServer(this.config);
            this.commandServer.start(this.startCallback, this.startTimeout);
        }
    }

    /** Function is bound to 'error' on the broadcast socket, called whenever an error occurs */
    private onError(err: Error) {
    }

    /** Function is bound to 'close' on the broadcast socket, called whenever the socket is closed */
    private onClose() {
        this.bIsRunning = false;
    }

}


/**
 * The command server, mostly just handles the `CommandSocket` which sends/recives data from Unreal Engine
 */
class CommandServer {
    private server;
    private config;
    private commandSocket: CommandSocket | null = null;
    private startCallback?: (error?: Error) => void;

    private bIsRunning = false;

    private onSocketClosedEvents: Function[] = [];
    private bExpectingConnection = false;

    constructor(config = new RemoteExecutionConfig()) {
        this.server = net.createServer();
        this.config = config;
    }

    /**
     * Bind a function to an event on this socket.
     * @param event The event to bind to
     * @param listener Function to call when the event is fired
     */
    public onSocket(event: "close", listener: Function) {
        if (event === "close") {
            this.onSocketClosedEvents.push(listener);
        }
    }

    /** Check if command server is running */
    public isRunning() {
        return this.bIsRunning;
    }

    /**
     * Start the command server
     * @param callback Function to call once the CommandServer has started & recived a connection
     * @param timeout Number of seconds to wait before timing out
     */
    public start(callback?: ((error?: Error) => void), timeout = 2) {
        this.startCallback = callback;

        this.server.on('error', this.onError);
        this.server.on('connection', (socket: net.Socket) => this.onConnection(socket));
        this.server.on('close', this.onClose);

        this.bExpectingConnection = true;
        this.server.listen(this.config.commandEndpoint[1], this.config.commandEndpoint[0]);

        // Start a timeout
        if (timeout) {
            setTimeout(() => {
                // If `bIsRunning` is not true within x seconds, call the timeout function
                if (!this.bIsRunning) {
                    this.timeoutStart();
                }
            }, timeout * 1000);
        }
    }

    /**
     * Pass along a message to the CommandSocket, which in turn sends the message to the Unreal remote server
     * @param message The message to send
     * @param callback Function to call with the response from Unreal's remote server
     */
    public sendMessage(message: RemoteExecutionMessage, callback?: (message: RemoteExecutionMessage) => void) {
        if (this.commandSocket) {
            this.commandSocket.write(message.toJsonString(), callback);
        }
    }

    /**
     * Close this CommandServer & socket
     * @param callback Function to call once it's closed
     */
    public close(callback?: (error?: Error) => void) {
        if (this.isRunning() && this.commandSocket) {
            this.commandSocket.close(() => {
                if (this.server) {
                    this.server.close(callback);
                }
            });
        }

        else if (this.server) {
            this.server.close(callback);
        }

        else if (callback) {
            callback();
        }
    }

    /**
     * Called when we've recived a connection with Unreal
     * @param socket 
     */
    private onConnection(socket: net.Socket) {
        if (!this.bExpectingConnection) {
            // Check if we're expecting a connection at this moment, otherwise it may be something else trying to connect on this port
            return;
        }

        this.commandSocket = new CommandSocket(socket);
        this.commandSocket.socket.on('close', (bHadError: boolean) => { this.onSocketClosed(bHadError); });

        this.bIsRunning = true;

        if (this.startCallback) {
            this.startCallback();
        }

        this.bExpectingConnection = false;
    }

    /**
     * timeout the start command
     */
    private timeoutStart() {
        this.close();

        if (this.startCallback) {
            const error = new Error("Timed out while trying to connect to Unreal Engine.");
            this.startCallback(error);
        }
    }

    /** Bound to the 'close' event on the server */
    private onClose() {
        this.commandSocket = null;
        this.bIsRunning = false;
    }

    /** 
     * Bound to the 'close' event on the CommandSocket
     * @param bHadError True if there was an error that caused it to close
    */
    private onSocketClosed(bHadError: boolean) {
        for (const callback of this.onSocketClosedEvents) {
            callback();
        }
    }

    /** Bound to the 'error' event on the server */
    private onError(error: Error) {
        throw error;
    }

}


/**
 * The `CommandSocket` is the socket connected that sends & recives data from Unreal Engine's Remote Execution server
 */
class CommandSocket {
    public socket;

    private bIsWriting = false;
    private commandQue: any = [];
    private callbacks: (Function | undefined)[] = [];

    /**
     * @param socket The socket provided by the `CommandServer` once it has established a connection w/ Unreal
     */
    constructor(socket: net.Socket) {
        this.socket = socket;

        this.socket.on('error', this.onError);
        this.socket.on('data', data => { this.onData(data); });
    }

    /**
     * Close this socket
     * @param callback Function to call once the socket has closed
     */
    public close(callback?: () => void) {
        this.socket.end(callback);
    }

    /**
     * Write something to the command server
     * @param buffer Text to write
     * @param callback Function to call with the response from the remote server
     */
    public write(buffer: string | Uint8Array, callback?: (message: RemoteExecutionMessage) => void) {
        // If we're already writing / waiting for a response, que the command
        if (this.bIsWriting) {
            this.queCommand(buffer, callback);
            return;
        }

        this.bIsWriting = true;  // Set writing to true to prevent other more commands from executing until this command is done.
        this.callbacks.push(callback);  // Store the callback function to call when data has been recived

        this.socket.write(buffer);
    }

    /**
     * Que a command to be executed once current command has completed
     * @param buffer The command to que
     * @param callback Function to call with the response from Unreal Engine
     */
    private queCommand(buffer: string | Uint8Array, callback?: Function) {
        this.commandQue.push([buffer, callback]);
    }

    /**
     * Look through the command que and if there is a command waiting, send it
     */
    private handleNextCommandInQue() {
        if (this.commandQue.length > 0) {
            // Get the next command in line
            const command = this.commandQue.shift();
            const buffer = command[0];
            const callback = command[1];
            this.callbacks.push(callback);

            this.socket.write(buffer);
        }
        else {
            // If command que is empty, set writing to false
            this.bIsWriting = false;
        }
    }

    /**
     * Bound to the 'data' event on the socket, called whenever data is recived from Unreal Engine
     * @param data The data recived, should be a dictionary that can be parsed into a `RemoteExecutionMessage`
     */
    private onData(data: Buffer) {
        // TODO: data may be split into multiple packets, if it's too large. We need to handle this.

        // If we have a callback stored, call it with the parsed message
        const callback = this.callbacks.shift();
        if (callback) {
            let message = undefined;
            try {
                // For now, place it in a try/catch block, if data is sent in multiple packets, this will fail
                message = RemoteExecutionMessage.fromBuffer(data);
            }
            catch (error) { }
            callback(message);
        }

        // Run the next command in que
        this.handleNextCommandInQue();
    }

    /** Bound to the 'error' event on the socket */
    private onError(error: Error) {
        throw error;
    }

}


/**
 * The message sent to/from Unreal's remote execution server
 */
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
     * Convert this message to its JSON representation. That can be sent to Unreal
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

    /**
     * @returns A list of command outputs
     */
    public getCommandResultOutput() {
        if (this.type === FCommandTypes.commandResults) {
            const outputs: [{ type: string, output: string }] = this.data.output;
            // Trim all output strings
            for (const output of outputs) {
                output.output = output.output.trim();
            }
            return outputs;
        }
        return [];
    }

    /**
     * Static function to convert json data to a `RemoteExecutionMessage`
     * @returns a `RemoteExecutionMessage` object
     */
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

    /**
     * Static function to convert buffer to a `RemoteExecutionMessage`
     * @param buffer The buffer recived from the exection server 
     * @returns a `RemoteExecutionMessage` object
     */
    static fromBuffer(buffer: Buffer) {
        const jsonString = buffer.toString();
        const jsonData = JSON.parse(jsonString);
        return this.fromJson(jsonData);
    }
}