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


export function sendCommand(command: string, callback?: Function) {
    const remoteConnection = getRemoteConnection();
    
    remoteConnection.runCommand(command);
}


export function executeFile(filepath: string, variables = {}, callback?: Function) {
    let variableString = "";
    for (const [key, value] of Object.entries(variables)) {
        let safeValueStr = value;
        if (typeof value === "string") {
            safeValueStr = `"${value}"`;
        }
        variableString += `${key}=${safeValueStr};`;
    }

    sendCommand(`${variableString}f=open(r'${filepath}','r');exec(f.read());f.close()`, callback);
}