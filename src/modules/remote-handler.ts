/**
 * A module handling the connection between Unreal and VSCode
 */

import * as vscode from 'vscode';

import * as remoteExecution from "./remote-execution";
import * as extensionWiki from "./extension-wiki";
import * as utils from "./utils";

let gRemoteConnection: remoteExecution.RemoteConnection | null = null;


function getRemoteConfig() {
    const extConfig = utils.getExtensionConfig();

    const multicastTTL: number | undefined = extConfig.get("remote.multicastTTL");
    const multicastGroupEndpoint: string | undefined = extConfig.get("remote.multicastGroupEndpoint");
    const multicastBindAddress: string | undefined = extConfig.get("remote.multicastBindAddress");
    const commandEndpoint: string | undefined = extConfig.get("remote.commandEndpoint");

    return new remoteExecution.RemoteExecutionConfig(multicastTTL, multicastGroupEndpoint, multicastBindAddress, commandEndpoint);
}

export function getRemoteConnection(bEnsureConnection = true) {
    if (!gRemoteConnection && bEnsureConnection) {

        const config = getRemoteConfig();
        gRemoteConnection = new remoteExecution.RemoteConnection(config);
    }
    return gRemoteConnection;
}


export function sendCommand(command: string, callback?: (message: remoteExecution.RemoteExecutionMessage) => void) {
    const remoteConnection = getRemoteConnection();
    if (!remoteConnection) {
        return;
    }

    if (remoteConnection.hasStartBeenRequested()) {
        remoteConnection.runCommand(command, callback);
    }
    else {
        const timeout: number | undefined = utils.getExtensionConfig().get("remote.timeout");
        remoteConnection.start((error?: Error | undefined) => {
            if (error) {
                vscode.window.showErrorMessage(error.message, "Help").then(((clickedValue?: string) => {
                    if (clickedValue === "Help") {
                        extensionWiki.openPageInBrowser(extensionWiki.Pages.failedToConnect);
                    }
                }));

            }
            else {
                remoteConnection.runCommand(command, callback);
            }
        }, timeout);
    }

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


export function closeRemoteConnection(callback?: (error?: Error) => void) {
    const remoteConnection = getRemoteConnection(false);
    if (remoteConnection) {
        remoteConnection.stop(callback);
    }
}