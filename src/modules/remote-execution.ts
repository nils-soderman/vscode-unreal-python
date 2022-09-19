/**
 * Remote connection between JavaScript & Unreal Engine.
 * Keep this module generic, do not import 'vscode' here!
 */

import * as dgram from 'dgram';
import * as uuid from 'uuid';
import * as net from 'net';


const PROTOCOL_VERSION = 1;                                   // Protocol version number
const PROTOCOL_MAGIC = 'ue_py';                               // Protocol magic identifier
const TYPE_PING = 'ping';                                     // Service discovery request (UDP)
const TYPE_PONG = 'pong';                                     // Service discovery response (UDP)
const TYPE_OPEN_CONNECTION = 'open_connection';               // Open a TCP command connection with the requested server (UDP)
const TYPE_CLOSE_CONNECTION = 'close_connection';             // Close any active TCP command connection (UDP)
const TYPE_COMMAND = 'command';                               // Execute a remote Python command (TCP)
const TYPE_COMMAND_RESULT = 'command_result';                 // Result of executing a remote Python command (TCP)


const DEFAULT_MULTICAST_TTL = 0;                                                 // Multicast TTL (0 is limited to the local host, 1 is limited to the local subnet)
const DEFAULT_MULTICAST_GROUP_ENDPOINT: [string, number] = ['239.0.0.1', 6766];  // The multicast group endpoint tuple that the UDP multicast socket should join (must match the "Multicast Group Endpoint" setting in the Python plugin)
const DEFAULT_MULTICAST_BIND_ADDRESS = '0.0.0.0';                                // The adapter address that the UDP multicast socket should bind to, or 0.0.0.0 to bind to all adapters (must match the "Multicast Bind Address" setting in the Python plugin)
const DEFAULT_COMMAND_ENDPOINT: [string, number] = ['127.0.0.1', 6776];          // The endpoint tuple for the TCP command connection hosted by this client (that the remote client will connect to)


export class FExecMode {
    static execFile = 'ExecuteFile';                          // Execute the Python command as a file. This allows you to execute either a literal Python script containing multiple statements, or a file with optional arguments
    static execStatement = 'ExecuteStatement';                // Execute the Python command as a single statement. This will execute a single statement and print the result. This mode cannot run files
    static evalStatement = 'EvaluateStatement';
}


export class RemoteExecutionConfig {
    multicastTTL;
    multicastGroupEndpoint;
    multicastBindAddress;
    commandEndpoint;

    constructor
        (
            multicastTTL = DEFAULT_MULTICAST_TTL,
            multicastGroupEndpoint = DEFAULT_MULTICAST_GROUP_ENDPOINT,
            multicastBindAddress = DEFAULT_MULTICAST_BIND_ADDRESS,
            commandEndpoint = DEFAULT_COMMAND_ENDPOINT
        ) {
        this.multicastTTL = multicastTTL;
        this.multicastGroupEndpoint = multicastGroupEndpoint;
        this.multicastBindAddress = multicastBindAddress;
        this.commandEndpoint = commandEndpoint;
    }
}


/**
 * 
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


export class RemoteConnection {
    private _config: RemoteExecutionConfig;
    private _nodeId: string;
    private _broadcastSocket: BroadcastSocket | null = null;

    constructor(config = new RemoteExecutionConfig()) {
        this._config = config;
        this._nodeId = uuid.v4();
    }

    /**
     * Check if start() has already been requested, this does not mean that the server and all sockets has actually fully started yet.
     */
    public hasStartBeenRequested() {
        return this._broadcastSocket === null;
    }

    public start(cb?: ((err?: Error | undefined) => void)) {
        this._broadcastSocket = new BroadcastSocket(this._config, this._nodeId);
        this._broadcastSocket.open(cb);
    }

    public stop() {
        if (this._broadcastSocket) {
            this._broadcastSocket.close();
        }
        this._broadcastSocket = null;
    }

    public async runCommand(command: string, callback?: (message: RemoteExecutionMessage) => void, bUnattended = true, execMode = FExecMode.execStatement, bRaiseOnFailure = false) {
        if (!this._broadcastSocket) {
            // Start the broadcast socket and re-run this function
            this.start(() => {
                this.runCommand(command, callback, bUnattended, execMode, bRaiseOnFailure);
            });
            return;
        }

        // If broadcast socket isn't running yet, wait a few sec for it to start
        if (!this._broadcastSocket.isRunning()) {
            if (!(await timeoutCheck(25, 0.2, this._broadcastSocket.isRunning))) {
                return false;
            }
        }

        const message = new RemoteExecutionMessage(TYPE_COMMAND, this._nodeId, null, {
            'command': command,
            'unattended': bUnattended,
            'exec_mode': execMode,  /* eslint-disable-line  @typescript-eslint/naming-convention */
        });

        return this._broadcastSocket.sendMessage(message, callback);
    }
}


class BroadcastSocket {
    private _bIsRunning = false;;
    private _socket;
    private _nodeId;
    private _config;
    private commandServer: CommandServer | null = null;
    private startCallback?: (() => void);

    constructor(config: RemoteExecutionConfig = new RemoteExecutionConfig(), nodeId: string) {
        this._nodeId = nodeId;
        this._config = config;
        this._socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    }

    public isRunning() {
        return this._bIsRunning;
    }

    public isCommandServerRunning() {
        return this._bIsRunning && this.commandServer && this.commandServer.isRunning();
    }

    public open(cb?: (() => void)) {
        console.log("Opening broadcast socket...");

        this.startCallback = cb;

        // Hook up events
        this._socket.on('listening', () => this.onListening());
        this._socket.on('message', (message: Buffer, remote: dgram.RemoteInfo) => this.onMessage(message, remote));
        this._socket.on('error', (err: Error) => this.onError(err));
        this._socket.on('connect', () => {
            console.log("connected");
        });
        this._socket.on('close', this.onClose);

        this._socket.bind({
            address: this._config.multicastBindAddress,
            port: this._config.multicastGroupEndpoint[1]
        });
    }


    public close() {

    }

    private onClose() {
        this._bIsRunning = false;
    }

    private onConnect(err: Error | null, bytes: number) {
        // TODO: Start command server here?
        if (err) {
            throw err;
        }
    }

    private onListening() {
        var address = this._socket.address();
        console.log('UDP Client listening on ' + address.address + ":" + address.port);
        // socket.setBroadcast(true);
        this._socket.setMulticastLoopback(true);
        this._socket.setMulticastTTL(this._config.multicastTTL);

        // _broadcast_socket.setsockopt(_socket.IPPROTO_IP, _socket.IP_MULTICAST_IF, _socket.inet_aton(_config.multicast_bind_address))
        this._socket.setMulticastInterface(this._config.multicastBindAddress);

        // _broadcast_socket.setsockopt(_socket.IPPROTO_IP, _socket.IP_ADD_MEMBERSHIP, _socket.inet_aton(_config.multicast_group_endpoint[0]) + _socket.inet_aton(_config.multicast_bind_address))
        this._socket.addMembership(this._config.multicastGroupEndpoint[0]);

        this._bIsRunning = true;

        this._openCommandServer();
    }

    private onMessage(message: Buffer, remote: dgram.RemoteInfo) {
        const remoteMessage = RemoteExecutionMessage.fromBuffer(message);

        console.log("Recived message on broadcast server:");
        console.log(remoteMessage);

        if (remoteMessage.type === TYPE_OPEN_CONNECTION) {
            this.commandServer = new CommandServer(this._nodeId, this._config);
            this.commandServer.start(this.startCallback);

        }
    }

    private onError(err: Error) {
        console.log("On Error: " + err);
    }

    private _openCommandServer() {
        const message = new RemoteExecutionMessage(TYPE_OPEN_CONNECTION, this._nodeId, null, {
            'command_ip': this._config.commandEndpoint[0],  /* eslint-disable-line  @typescript-eslint/naming-convention */
            'command_port': this._config.commandEndpoint[1],  /* eslint-disable-line @typescript-eslint/naming-convention */
        });

        this._socket.send(message.toJsonString(), this._config.multicastGroupEndpoint[1], this._config.multicastGroupEndpoint[0], this.onConnect);
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
    private _config;
    private _nodeId;
    private commandSocket: CommandSocket | undefined;
    private startCallback?: (() => void);

    private _bIsRunning = false;

    private commandQue = [];

    constructor(nodeId: string, config = new RemoteExecutionConfig()) {
        this.server = net.createServer();
        this._config = config;
        this._nodeId = nodeId;
    }

    public isRunning() {
        return this._bIsRunning;
    }

    public start(cb?: (() => void)) {
        console.log("Starting CommandServer...");

        this.startCallback = cb;

        this.server.on('error', this.onError);
        this.server.on('listening', this.onListening);
        this.server.on('connection', (socket: net.Socket) => this.onConnection(socket));
        this.server.on('close', this.onClose);

        this.server.listen(this._config.commandEndpoint[1], this._config.commandEndpoint[0]);
    }

    private onError(err: Error) {
        throw err;
    }

    private onListening() {
        const address = this.server.address();
    }

    private onConnection(socket: net.Socket) {
        console.log("CommandServer started, socket recived.");
        this.commandSocket = new CommandSocket(socket);
        if (this.startCallback) {
            this.startCallback();
        }

        this._bIsRunning = true;
    }

    private onClose() {
        this._bIsRunning = false;
    }

    public sendMessage(message: RemoteExecutionMessage, callback?: (message: RemoteExecutionMessage) => void) {
        if (this.commandSocket) {
            this.commandSocket.write(message.toJsonString(), callback);
        }
    }
}



// TODO: This class may be redundant?
class CommandSocket {
    private socket;
    private bIsWriting = false;

    private commandQue: any = [];

    private callbacks: (Function | undefined)[] = [];

    constructor(socket: net.Socket) {
        this.socket = socket;

        this.socket.on('error', this.onError);
        this.socket.on('data', (data: Buffer) => { this.onData(data); });
        this.socket.on('close', this.onClose);
    }

    private onClose() {
        console.log("Socket closed");
    }

    private onData(data: Buffer) {
        // let message = data.toString();
        const callback = this.callbacks.shift();
        if (callback) {
            const message = RemoteExecutionMessage.fromBuffer(data);
            callback(message);
        }

        this.handleNextCommandInQue();
    }

    private onError(err: Error) {
        console.log("Error:" + err);
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
            this._write(buffer, callback);
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

    static fromJson(jsonData: any) {
        if (jsonData['version'] !== PROTOCOL_VERSION) {
            throw Error(`"version" is incorrect (got ${jsonData['version']}, expected ${PROTOCOL_VERSION})!`);
        }
        if (jsonData['magic'] !== PROTOCOL_MAGIC) {
            throw Error(`"magic" is incorrect (got ${jsonData['magic']}, expected ${PROTOCOL_MAGIC})!`);
        }

        let type = jsonData['type'];
        let source = jsonData['source'];
        let dest = jsonData['dest'];
        let data = jsonData['data'];

        return new RemoteExecutionMessage(type, source, dest, data);
    }

    static fromBuffer(buffer: Buffer) {
        const jsonString = buffer.toString();
        const jsonData = JSON.parse(jsonString);
        return this.fromJson(jsonData);
    }
}

export async function test() {
    const remoteConnection = new RemoteConnection();

    remoteConnection.start(() => {
        remoteConnection.runCommand("print('Hello World from VSCode!')");
    });

}
