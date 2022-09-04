// Unreal's 'remote_execution.py' module converted to TypeScript

/*eslint "@typescript-eslint/naming-convention": "off" */

import * as uuid from 'uuid';
import * as dgram from 'dgram';
import * as net from 'net';


const _PROTOCOL_VERSION = 1;                                   // Protocol version number
const _PROTOCOL_MAGIC = 'ue_py';                               // Protocol magic identifier
const _TYPE_PING = 'ping';                                     // Service discovery request (UDP)
const _TYPE_PONG = 'pong';                                     // Service discovery response (UDP)
const _TYPE_OPEN_CONNECTION = 'open_connection';               // Open a TCP command connection with the requested server (UDP)
const _TYPE_CLOSE_CONNECTION = 'close_connection';             // Close any active TCP command connection (UDP)
const _TYPE_COMMAND = 'command';                               // Execute a remote Python command (TCP)
const _TYPE_COMMAND_RESULT = 'command_result';                 // Result of executing a remote Python command (TCP)

const _NODE_PING_SECONDS = 1;                                  // Number of seconds to wait before sending another "ping" message to discover remote notes
const _NODE_TIMEOUT_SECONDS = 5;                               // Number of seconds to wait before timing out a remote node that was discovered via UDP and has stopped sending "pong" responses

const DEFAULT_MULTICAST_TTL = 0;                                // Multicast TTL (0 is limited to the local host, 1 is limited to the local subnet)
const DEFAULT_MULTICAST_GROUP_ENDPOINT_IP = '239.0.0.1';  // The multicast group endpoint tuple that the UDP multicast socket should join (must match the "Multicast Group Endpoint" setting in the Python plugin)
const DEFAULT_MULTICAST_GROUP_ENDPOINT_PORT = 6766;  // The multicast group endpoint tuple that the UDP multicast socket should join (must match the "Multicast Group Endpoint" setting in the Python plugin)
const DEFAULT_MULTICAST_BIND_ADDRESS = '0.0.0.0';              // The adapter address that the UDP multicast socket should bind to, or 0.0.0.0 to bind to all adapters (must match the "Multicast Bind Address" setting in the Python plugin)
const DEFAULT_COMMAND_ENDPOINT = ['127.0.0.1', 6776];          // The endpoint tuple for the TCP command connection hosted by this client (that the remote client will connect to)

// Execution modes (these must match the names given to LexToString for EPythonCommandExecutionMode in IPythonScriptPlugin.h)
const MODE_EXEC_FILE = 'ExecuteFile';                          // Execute the Python command as a file. This allows you to execute either a literal Python script containing multiple statements, or a file with optional arguments
const MODE_EXEC_STATEMENT = 'ExecuteStatement';                // Execute the Python command as a single statement. This will execute a single statement and print the result. This mode cannot run files
const MODE_EVAL_STATEMENT = 'EvaluateStatement';


/** Configuration data for establishing a remote connection with a UE4 instance running Python. */
export class RemoteExecutionConfig {
    multicast_ttl = DEFAULT_MULTICAST_TTL;
    multicast_group_endpoint_ip = DEFAULT_MULTICAST_GROUP_ENDPOINT_IP;
    multicast_group_endpoint_port = DEFAULT_MULTICAST_GROUP_ENDPOINT_PORT;
    multicast_bind_address = DEFAULT_MULTICAST_BIND_ADDRESS;
    command_endpoint = DEFAULT_COMMAND_ENDPOINT;
}

export function BrodcastSocket(config: RemoteExecutionConfig = new RemoteExecutionConfig()) {
    var socket = dgram.createSocket({type:"udp4", reuseAddr:true});
    // socket.setsockopt(dgram.SOL_SOCKET, dgram.SO_REUSEADDR, 1);

    const id = uuid.v4();
    
    socket.on('listening', function () {
        var address = socket.address();
        console.log('UDP Client listening on ' + address.address + ":" + address.port);
        // socket.setBroadcast(true);
        socket.setMulticastLoopback(true);
        socket.setMulticastTTL(config.multicast_ttl); 

        // _broadcast_socket.setsockopt(_socket.IPPROTO_IP, _socket.IP_MULTICAST_IF, _socket.inet_aton(_config.multicast_bind_address))
        socket.setMulticastInterface(config.multicast_bind_address);

        // _broadcast_socket.setsockopt(_socket.IPPROTO_IP, _socket.IP_ADD_MEMBERSHIP, _socket.inet_aton(_config.multicast_group_endpoint[0]) + _socket.inet_aton(_config.multicast_bind_address))
        socket.addMembership(config.multicast_group_endpoint_ip);
        
    });

    socket.on('message', function (message, remote) {   
        console.log('A: Epic Command Received. Preparing Relay.');
        console.log('B: From: ' + remote.address + ':' + remote.port +' - ' + message);
        OpenCommandSocket(config, id);
    });

    socket.on('error', function(err)
    {
        console.log("Socket error: " + err);
    });

    socket.on('connect', function(err: any)
    {
        console.log("On Connect: " + err);
    });

    socket.bind({
        address: config.multicast_bind_address,
        port: config.multicast_group_endpoint_port
    });

    console.log("Bound");

    

    let open_connection = {"version": 1, "magic": "ue_py", "type": "open_connection", "source": id, "data": {"command_ip": "127.0.0.1", "command_port": 6776}};
    let Message = JSON.stringify(open_connection);;
    socket.send(Message, 6766, '239.0.0.1');





    // socket.setsockopt(dgram.IPPROTO_IP, dgram.IP_MULTICAST_LOOP, 1);
    // socket.setsockopt(dgram.IPPROTO_IP, dgram.IP_MULTICAST_TTL, config.multicast_ttl);
    // socket.setsockopt(dgram.IPPROTO_IP, dgram.IP_MULTICAST_IF, new Buffer(config.multicast_bind_address));
    // socket.setsockopt(dgram.IPPROTO_IP, dgram.IP_ADD_MEMBERSHIP, new Buffer(config.multicast_group_endpoint[0])
    
}

function OpenCommandSocket(config: RemoteExecutionConfig = new RemoteExecutionConfig(), id: string)
{
    // Open the command socket

    const commandListenSocket = net.createServer();

    commandListenSocket.on('error', function(err) {
        console.error(err);
    });

    commandListenSocket.on('listening', function() {
        const address = commandListenSocket.address();
    });

    commandListenSocket.on('connection', function(socket) {
        let open_connection = {"version": 1, "magic": "ue_py", "type": "command", "source": id, "data": {"command": "print('VSCODE')", "unattended": true, "exec_mode": "ExecuteFile"}};
        let Message = JSON.stringify(open_connection);
        socket.write(Message, function(cb) {
            console.log(cb);
        });
    });

    commandListenSocket.on('close', function() {
        console.log("close");
    });

    // commandListenSocket.listen(config.command_endpoint.port, config.command_endpoint.ip);
    commandListenSocket.listen(6776, '127.0.0.1');
    
    
    return;

    let commandSocket = net.createConnection(6776, '127.0.0.1');

    commandSocket.on('error', (e) => {
            console.log(e.stack);
    });

    commandSocket.on("data", function (buffer) {
        let dataRecived = buffer.toString("utf8");
        console.log("Recived" + dataRecived);
    });

    commandSocket.on('close', (h: any | undefined) => {
        console.log("Closed.");
    });
}