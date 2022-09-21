/**
 * A module handling the connection between Unreal and VSCode
 */

import * as remoteExecution from "./remote-execution";
import * as utils from "./utils";

let gRemoteConnection: remoteExecution.RemoteConnection;


function getRemoteConfig() {
    const extConfig = utils.getExtensionConfig();
    
    const multicastTTL: number | undefined = extConfig.get("remote.multicastTTL");
    const multicastGroupEndpoint: string | undefined = extConfig.get("remote.multicastGroupEndpoint");
    const multicastBindAddress: string | undefined = extConfig.get("remote.multicastBindAddress");
    const commandEndpoint: string | undefined = extConfig.get("remote.commandEndpoint");
    
    return new remoteExecution.RemoteExecutionConfig(multicastTTL, multicastGroupEndpoint, multicastBindAddress, commandEndpoint);
}

export function getRemoteConnection() {
    if (!gRemoteConnection) {

        const config = getRemoteConfig();
        gRemoteConnection = new remoteExecution.RemoteConnection(config);
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