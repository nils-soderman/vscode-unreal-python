/**
 * A module handling the connection between Unreal and VSCode
 */

import * as vscode from 'vscode';

import * as remoteExecution from "./remote-execution";
import * as extensionWiki from "./extension-wiki";
import * as utils from "./utils";

let gRemoteConnection: remoteExecution.RemoteConnection | null = null;


/**
 * Get a `RemoteExecutionConfig` based on the extension user settings
 */
function getRemoteConfig() {
    const extensionConfig = utils.getExtensionConfig();

    const multicastTTL: number | undefined = extensionConfig.get("remote.multicastTTL");
    const multicastGroupEndpoint: string | undefined = extensionConfig.get("remote.multicastGroupEndpoint");
    const multicastBindAddress: string | undefined = extensionConfig.get("remote.multicastBindAddress");
    const commandEndpoint: string | undefined = extensionConfig.get("remote.commandEndpoint");

    return new remoteExecution.RemoteExecutionConfig(multicastTTL, multicastGroupEndpoint, multicastBindAddress, commandEndpoint);
}


/**
 * Make sure the command port is avaliable, and if not it'll try to find a port that's free and modify the port in config to use this new port.
 * @param config The remote execution config
 * @returns A list with 2 elements, the first one is a boolean depending on if a free port was found/assigned to the config. Second element is a error message.
 */
async function ensureCommandPortAvaliable(config: remoteExecution.RemoteExecutionConfig): Promise<[boolean, string]> {
    const extensionConfig = utils.getExtensionConfig();

    const host = config.commandEndpoint[0];
    const commandEndpointPort = config.commandEndpoint[1];

    // Check if user has enabled 'strictPort' 
    if (extensionConfig.get("strictPort")) {
        if (!await utils.isPortAvailable(commandEndpointPort, host)) {
            return [false, `Port ${commandEndpointPort} is currently busy.  Consider changing the config: 'ue-python.remote.commandEndpoint'.`];
        }
    }
    else {
        // Check the next 100 ports, one should hopefully be free
        const freePort = await utils.findFreePort(commandEndpointPort, 101, host);
        if (!freePort) {
            return [false, `All ports between ${commandEndpointPort} - ${commandEndpointPort + 100} are busy. Consider changing the config: 'ue-python.remote.commandEndpoint'.`];
        }

        // If the first found free port wasn't the original port, update it
        if (commandEndpointPort !== freePort) {
            config.commandEndpoint[1] = freePort;
        }
    }

    return [true, ""];
}


/**
 * Get the global remote connection instance
 * @param bEnsureConnection If a connection doesn't exists yet, create one.
 */
export async function getRemoteConnection(bEnsureConnection = true) {
    if (!gRemoteConnection && bEnsureConnection) {
        const config = getRemoteConfig();

        // Make sure the config has a port that isn't taken by something else
        const response = await ensureCommandPortAvaliable(config);
        if (response[0]) {
            gRemoteConnection = new remoteExecution.RemoteConnection(config);
        } else {
            vscode.window.showErrorMessage(response[1]);
        }
    }

    return gRemoteConnection;
}


/**
 * Send a command to the remote connection
 * @param command The python code as a string
 * @param callback The function to call with the response from Unreal
 */
export async function sendCommand(command: string, callback?: (message: remoteExecution.RemoteExecutionMessage) => void) {
    const remoteConnection = await getRemoteConnection();
    if (!remoteConnection) {
        return;
    }

    // Check if we have at least once requested to start a remote connection
    if (remoteConnection.hasStartBeenRequested()) {
        remoteConnection.runCommand(command, callback);
    }
    else {
        // Run the start command with a timeout
        const timeout: number | undefined = utils.getExtensionConfig().get("remote.timeout");

        remoteConnection.start(async error => {
            if (error) {
                const clickedItem = await vscode.window.showErrorMessage(error.message, "Help");
                if (clickedItem === "Help") {
                    extensionWiki.openPageInBrowser(extensionWiki.FPages.failedToConnect);
                }
            }
            else {
                // If no error was provided the server should've started successfully
                remoteConnection.runCommand(command, callback);
            }

        }, timeout);
    }

}


/**
 * Execute a file in Unreal through the remote exection
 * @param filepath Absolute filepath to the python file to execute
 * @param variables Optional dict with global variables to set before executing the file
 * @param callback Function to call with the response from Unreal
 */
export function executeFile(filepath: string, variables = {}, callback?: (message: remoteExecution.RemoteExecutionMessage) => void) {
    // Construct a string with all of the global variables, e.g: "x=1;y='Hello';"
    let variableString = `__file__=r'${filepath}';`;

    for (const [key, value] of Object.entries(variables)) {
        let safeValueStr = value;
        if (typeof value === "string") {
            // Append single quotes ' to the start & end of the value
            safeValueStr = `r'${value}'`;
        }

        variableString += `${key}=${safeValueStr};`;
    }

    // Put together one line of code for settings the global variables, then opening, reading & executing the given filepath
    const command = `${variableString}f=open(r'${filepath}','r');exec(f.read());f.close()`;
    sendCommand(command, callback);
}


/**
 * Close the global remote connection, if there is one
 * @param callback Function to call once connection has fully closed
 */
export async function closeRemoteConnection(callback?: (error?: Error) => void) {
    const remoteConnection = await getRemoteConnection(false);
    if (remoteConnection) {
        remoteConnection.stop(callback);
    }
}