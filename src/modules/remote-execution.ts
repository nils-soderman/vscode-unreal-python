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

const NODE_PING_SECONDS = 1;                                  // Number of seconds to wait before sending another "ping" message to discover remote notes
const NODE_TIMEOUT_SECONDS = 5;                               // Number of seconds to wait before timing out a remote node that was discovered via UDP and has stopped sending "pong" responses

const DEFAULT_MULTICAST_TTL = 0;                                                 // Multicast TTL (0 is limited to the local host, 1 is limited to the local subnet)
const DEFAULT_MULTICAST_GROUP_ENDPOINT: [string, number] = ['239.0.0.1', 6766];  // The multicast group endpoint tuple that the UDP multicast socket should join (must match the "Multicast Group Endpoint" setting in the Python plugin)
const DEFAULT_MULTICAST_BIND_ADDRESS = '0.0.0.0';                                // The adapter address that the UDP multicast socket should bind to, or 0.0.0.0 to bind to all adapters (must match the "Multicast Bind Address" setting in the Python plugin)
const DEFAULT_COMMAND_ENDPOINT: [string, number] = ['127.0.0.1', 6776];          // The endpoint tuple for the TCP command connection hosted by this client (that the remote client will connect to)

// Execution modes (these must match the names given to LexToString for EPythonCommandExecutionMode in IPythonScriptPlugin.h)
const MODE_EXEC_FILE = 'ExecuteFile';                          // Execute the Python command as a file. This allows you to execute either a literal Python script containing multiple statements, or a file with optional arguments
const MODE_EXEC_STATEMENT = 'ExecuteStatement';                // Execute the Python command as a single statement. This will execute a single statement and print the result. This mode cannot run files
const MODE_EVAL_STATEMENT = 'EvaluateStatement';


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


export class RemoteConnection {
    private _config: RemoteExecutionConfig;
    private _nodeId: string;
    private _broadcastSocket: BroadcastSocket | undefined;

    constructor(config = new RemoteExecutionConfig()) {
        this._config = config;
        this._nodeId = uuid.v4();
    }

    public start(cb?: ((err?: Error | undefined) => void)) {
        this._broadcastSocket = new BroadcastSocket(this._config, this._nodeId);
        this._broadcastSocket.open(cb);
    }

    public stop() {
        if (this._broadcastSocket) {
            this._broadcastSocket.close();
        }
    }

    public runCommand(command: string, bUnattended = true, execMode = FExecMode.execStatement, bRaiseOnFailure = false) {
        if (!this._broadcastSocket) {
            throw Error("A broadcast socket has not been created, use `start()` first.");
        }

        const message = new RemoteExecutionMessage(TYPE_COMMAND, this._nodeId, this._nodeId, {
            'command': command,
            'unattended': bUnattended,
            'exec_mode': execMode,
        });

        return this._broadcastSocket.sendMessage(message);
    }
}


class BroadcastSocket {
    private _socket;
    private _nodeId;
    private _config;
    private commandServer: CommandServer | undefined;
    private callback?: (() => void);

    constructor(config: RemoteExecutionConfig = new RemoteExecutionConfig(), nodeId: string) {
        this._nodeId = nodeId;
        this._config = config;
        this._socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    }

    public open(cb?: (() => void)) {
        console.log("Opening broadcast socket...");

        this.callback = cb;

        this._socket.on('listening', () => this.onListening());
        this._socket.on('message', (message: Buffer, remote: dgram.RemoteInfo) => this.onMessage(message, remote));
        this._socket.on('error', (err: Error) => this.onError(err));
        this._socket.on('connect', () => {
            console.log("connected");
        });

        this._socket.bind({
            address: this._config.multicastBindAddress,
            port: this._config.multicastGroupEndpoint[1]
        });
        // TODO: This should perhaps be sent after listening has begun

    }

    public close() {

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

        this._openCommandServer();
    }

    private onMessage(message: Buffer, remote: dgram.RemoteInfo) {
        const remoteMessage = RemoteExecutionMessage.fromBuffer(message);

        console.log("Recived message on broadcast server:");
        console.log(remoteMessage);

        if (remoteMessage.type === TYPE_OPEN_CONNECTION) {
            this.commandServer = new CommandServer(this._nodeId, this._config);
            this.commandServer.start(this.callback);
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

    public sendMessage(message: RemoteExecutionMessage) {
        if (!this.commandServer) {
            throw Error("Command server has not been started yet!");
        }

        return this.commandServer.sendMessage(message);
    }
}


class CommandServer {
    private server;
    private _config;
    private _nodeId;
    private commandSocket: CommandSocket | undefined;
    private startCallback?: (() => void);

    constructor(nodeId: string, config = new RemoteExecutionConfig()) {
        this.server = net.createServer();
        this._config = config;
        this._nodeId = nodeId;
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

        /*
        let open_connection = { "version": 1, "magic": "ue_py", "type": "command", "source": id, "data": { "command": "print('VSCODE')", "unattended": true, "exec_mode": "ExecuteFile" } };
        let Message = JSON.stringify(open_connection);
        socket.write(Message, function (cb) {
            console.log(cb);
        });
        */
    }


    private onClose() {
        console.log("close");
    }


    public sendMessage(message: RemoteExecutionMessage) {
        if (this.commandSocket) {
            this.commandSocket.write(message.toJsonString());
        }
    }
}


// TODO: This class may be redundant?
class CommandSocket {
    socket;

    constructor(socket: net.Socket) {
        this.socket = socket;

        this.socket.on('error', this.onError);
        this.socket.on('data', this.onData);
    }

    onData(data: Buffer) {
        let m = data.toString();
        console.log("m: " + m);
    }

    onError(err: Error) {

    }

    write(buffer: string | Uint8Array, cb?: ((err?: Error | undefined) => void) | undefined) {
        return this.socket.write(buffer, cb);
    }
}


class RemoteExecutionMessage {
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


export function test() {
    const remoteConnection = new RemoteConnection();

    remoteConnection.start(() => {
        remoteConnection.runCommand("print('Hello World from VSCode!')");
    });

}
