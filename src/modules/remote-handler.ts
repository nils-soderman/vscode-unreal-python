/**
 * A module handling the connection between Unreal and VSCode
 */

import * as remoteExecution from "./remote-execution";

let gRemoteConnection: remoteExecution.RemoteConnection;


export function getRemoteConnection() {
    if (!gRemoteConnection) {
        gRemoteConnection = new remoteExecution.RemoteConnection();
    }
    return gRemoteConnection;
}


export function sendCommand(command: string, callback?: (message: remoteExecution.RemoteExecutionMessage) => void) {
    const remoteConnection = getRemoteConnection();
    
    remoteConnection.runCommand(command, callback);
}


export function executeFile(filepath: string, variables = {}, callback?: (message: remoteExecution.RemoteExecutionMessage) => void) {
    let variableString = "";
    for (const [key, value] of Object.entries(variables)) {
        let safeValueStr = value;
        if (typeof value === "string") {
            safeValueStr = `r"${value}"`;
        }
        variableString += `${key}=${safeValueStr};`;
    }

    const command = `${variableString}f=open(r'${filepath}','r');exec(f.read());f.close()`;
    sendCommand(command, callback);
}