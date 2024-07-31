/**
 * A module handling the connection between Unreal and VSCode
 */

import * as vscode from 'vscode';

import { RemoteExecution, RemoteExecutionConfig, RemoteExecutionNode, ECommandOutputType } from "unreal-remote-execution";

import * as extensionWiki from "./extension-wiki";
import * as utils from "./utils";
import * as logger from "./logger";

let gIsInitializatingConnection = false;
let gCachedRemoteExecution: RemoteExecution | null = null;
let gStatusBarItem: vscode.StatusBarItem | null = null;


// ------------------------------------
//          Status Bar Item
// ------------------------------------

function getStatusBarItem(bEnsureExists = true) {
    if (!gStatusBarItem && bEnsureExists) {
        gStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
        gStatusBarItem.command = "ue-python.selectInstance";
        gStatusBarItem.tooltip = "Connected Unreal Engine instance";
    }
    return gStatusBarItem;
}


export function removeStatusBarItem() {
    gStatusBarItem?.dispose();
    gStatusBarItem = null;
}


export function updateStatusBar(node: RemoteExecutionNode) {
    const statusBarItem = getStatusBarItem();
    if (statusBarItem) {
        statusBarItem.text = `$(unreal-engine) ${node.data.project_name}`;
        statusBarItem.show();
    }
}


/**
 * Get a `RemoteExecutionConfig` based on the extension user settings
 */
function getRemoteConfig() {
    const extensionConfig = utils.getExtensionConfig();

    const multicastTTL: number | undefined = extensionConfig.get("remote.multicastTTL");
    const multicastBindAddress: string | undefined = extensionConfig.get("remote.multicastBindAddress");

    let multicastGroupEndpoint: [string, number] | undefined = undefined;
    const multicastGroupEndpointStr: string | undefined = extensionConfig.get("remote.multicastGroupEndpoint");
    if (multicastGroupEndpointStr) {
        const [multicastGroupStr, portStr] = multicastGroupEndpointStr.split(":", 2);
        multicastGroupEndpoint = [multicastGroupStr, Number(portStr)];
    }

    let commandEndpoint: [string, number] | undefined = undefined;
    const commandEndpointStr: string | undefined = extensionConfig.get("remote.commandEndpoint");
    if (commandEndpointStr) {
        const [commandHost, commandPortStr] = commandEndpointStr.split(":", 2);
        commandEndpoint = [commandHost, Number(commandPortStr)];
    }

    return new RemoteExecutionConfig(multicastTTL, multicastGroupEndpoint, multicastBindAddress, commandEndpoint);
}


/**
 * Make sure the command port is avaliable, and if not it'll try to find a port that's free and modify the port in config to use this new port.
 * @param config The remote execution config
 * @returns A list with 2 elements, the first one is a boolean depending on if a free port was found/assigned to the config. Second element is a error message.
 */
async function ensureCommandPortAvaliable(config: RemoteExecutionConfig): Promise<boolean> {
    const extensionConfig = utils.getExtensionConfig();

    const host = config.commandEndpoint[0];
    const commandEndpointPort = config.commandEndpoint[1];

    // Check if user has enabled 'strictPort' 
    if (extensionConfig.get("strictPort")) {
        if (!await utils.isPortAvailable(commandEndpointPort, host)) {
            vscode.window.showErrorMessage(`Port ${commandEndpointPort} is currently busy. Consider changing the config: 'ue-python.remote.commandEndpoint'.`);
            return false;
        }
    }
    else {
        // Check the next 100 ports, one should hopefully be free
        const freePort = await utils.findFreePort(commandEndpointPort, 101, host);
        if (!freePort) {
            vscode.window.showErrorMessage(`All ports between ${commandEndpointPort} - ${commandEndpointPort + 100} are busy. Consider changing the config: 'ue-python.remote.commandEndpoint'.`);
            return false;
        }

        // If the first found free port wasn't the original port, update it
        if (commandEndpointPort !== freePort) {
            config.commandEndpoint[1] = freePort;
        }
    }

    return true;
}


/**
 * Get the port the remote execution command connection is using
 */
export async function getRemoteExecutionCommandPort() {
    const remoteExecution = await getRemoteExecutionInstance(false);
    if (!remoteExecution)
        return null;

    return remoteExecution.config.commandEndpoint[1];
}


/**
 * Get the global remote connection instance
 * @param bEnsureConnection Make sure the remote execution instance exists, if not it'll create one.
 */
export async function getRemoteExecutionInstance(bEnsureExists = true) {
    if (!gCachedRemoteExecution && bEnsureExists) {
        const config = getRemoteConfig();
        if (await ensureCommandPortAvaliable(config)) {
            gCachedRemoteExecution = new RemoteExecution(config);
            gCachedRemoteExecution.events.addEventListener("commandConnectionClosed", onRemoteConnectionClosed);
            await gCachedRemoteExecution.start();

            logger.log("Remote execution instance created");
            logger.log(`Multicast TTL: ${config.multicastTTL}`);
            logger.log(`Multicast Bind Address: ${config.multicastBindAddress}`);
            logger.log(`Multicast Group Endpoint: ${config.multicastGroupEndpoint[0]}:${config.multicastGroupEndpoint[1]}`);
            logger.log(`Command Endpoint: ${config.commandEndpoint[0]}:${config.commandEndpoint[1]}`);
        }
    }

    return gCachedRemoteExecution;
}


export function nullifyRemoteExecutionInstance() {
    gCachedRemoteExecution?.stop();
    gCachedRemoteExecution = null;
}


/**
 * Get the global remote connection instance, and make sure it's connected
 * @returns The remote execution instance, or null if it failed to connect
 */
export async function getConnectedRemoteExecutionInstance(): Promise<RemoteExecution | null> {
    const remoteExecution = await getRemoteExecutionInstance();
    if (!remoteExecution)
        return null;

    if (!remoteExecution.hasCommandConnection()) {
        const config = getRemoteConfig();

        if (gIsInitializatingConnection) {
            return new Promise((resolve) => {
                const interval = setInterval(() => {
                    if (!gIsInitializatingConnection) {
                        clearInterval(interval);
                        resolve(getConnectedRemoteExecutionInstance());
                    }
                }, 1000);
            });
        }
        gIsInitializatingConnection = true;

        if (await ensureCommandPortAvaliable(config)) {
            const extensionConfig = utils.getExtensionConfig();
            const timeout: number = extensionConfig.get("remote.timeout") ?? 3000;

            logger.log(`Connecting with a timeout of ${timeout}ms.`);

            try {
                const node = await remoteExecution.getFirstRemoteNode(1000, timeout);
                await remoteExecution.openCommandConnection(node, true, timeout);

                logger.log("Connected to: " + JSON.stringify(node.data));

                await onRemoteInstanceCreated(remoteExecution);

                updateStatusBar(node);
            }
            catch (error: any) {
                logger.log(error);
                let message: string = error.message;
                if (message.startsWith("Timed out"))
                    message = "Timed out while trying to connect to Unreal Engine.";

                vscode.window.showErrorMessage(message, "Help").then((clickedItem) => {
                    if (clickedItem === "Help")
                        extensionWiki.openPageInBrowser(extensionWiki.FPages.failedToConnect);
                });

                nullifyRemoteExecutionInstance();
                return null;
            }
            finally {
                gIsInitializatingConnection = false;
            }
        }
        else {
            nullifyRemoteExecutionInstance();
            gIsInitializatingConnection = false;
            return null;
        }

    }

    return remoteExecution;
}


/**
 * Called when a remote instance is created
 */
async function onRemoteInstanceCreated(instance: RemoteExecution) {
    // Check if we should add any workspace folders to the python path
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        let foldersToAddToPath: string[] = [];
        for (const folder of workspaceFolders) {
            const config = vscode.workspace.getConfiguration(utils.EXTENSION_ID, folder.uri);
            if (config.get<boolean>('environment.addWorkspaceToPath', false)) {
                foldersToAddToPath.push(folder.uri.fsPath);
            }
        }

        if (foldersToAddToPath.length > 0) {
            const response = await executeFile(
                utils.FPythonScriptFiles.getUri(utils.FPythonScriptFiles.addSysPath),
                {
                    vsc_paths: foldersToAddToPath // eslint-disable-line @typescript-eslint/naming-convention
                }
            );

            if (response) {
                if (response.result && response.result !== "None")
                    logger.log(response.result);
                for (const output of response.output) {
                    if (output.type === ECommandOutputType.ERROR)
                        logger.logError("Ran into an error while adding workspace folders to the python path.", new Error(output.output));
                    else
                        logger.log(`[${output.type}] ${output.output}`);
                }
            }
        }
    }
}


/**
 * Called when the remote connection is closed
 */
async function onRemoteConnectionClosed() {
    const remoteExecution = await getRemoteExecutionInstance(false);
    if (!remoteExecution?.hasCommandConnection())
        removeStatusBarItem();

    logger.log("Remote connection closed");
}


/**
 * Send a command to the remote connection
 * @param command The python code as a string
 */
export async function runCommand(command: string) {
    const remoteExec = await getConnectedRemoteExecutionInstance();
    if (!remoteExec) {
        return;
    }

    const bUnattended = utils.getExtensionConfig().get("execute.unattended") ? true : false;

    return remoteExec.runCommand(command, bUnattended);
}


/**
 * Execute a file in Unreal through the remote exection
 * @param uri Absolute filepath to the python file to execute
 * @param variables Optional dict with global variables to set before executing the file
 */
export function executeFile(uri: vscode.Uri, globals: any = {}) {
    if (!globals.hasOwnProperty('__file__')) {
        globals["__file__"] = uri.fsPath;
    }

    let globalsStr = JSON.stringify(globals);
    globalsStr = globalsStr.replace(/\\/g, "\\\\");

    // Put together one line of code for settings the global variables, then opening, reading & executing the given filepath
    const command = `import json;globals().update(json.loads('${globalsStr}'));f=open(r'${uri.fsPath}','r');exec(f.read());f.close()`;
    return runCommand(command);
}


/**
 * Close the global remote connection, if there is one
 */
export async function closeRemoteConnection() {
    const remoteConnection = await getRemoteExecutionInstance(false);
    remoteConnection?.stop();
}