/**
 * Script to attach VS Code to Unreal Engine by starting a debugpy server
 * If debugpy is not installed user will be prompted to install it, with an option to automatically install it
 */

import * as vscode from 'vscode';

import * as remoteHandler from '../modules/remote-handler';
import * as utils from '../modules/utils';

import { RemoteExecutionMessage, FCommandOutputType } from "../modules/remote-execution";


// ------------------------------------------------------------------------------------------
//                               Installation of debugpy
// ------------------------------------------------------------------------------------------

/**
 * Check if the python module "debugpy" is installed and accessible with the current `sys.paths` in Unreal Engine.  
 */
function isDebugpyInstalled(): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const isDebugPyInstalledScript = utils.FPythonScriptFiles.getAbsPath(utils.FPythonScriptFiles.isDebugpyInstalled);

        remoteHandler.executeFile(isDebugPyInstalledScript, {}, (message: RemoteExecutionMessage) => {
            const outputs = message.getCommandResultOutput();

            for (let output of outputs) {
                if (output.type === FCommandOutputType.info) {
                    resolve(output.output.toLowerCase() === "true");
                    return;
                }
            }

            resolve(false);
        });
    });
}

/**
 * Check if the python module "debugpy" is installed and accessible with the current `sys.paths` in Unreal Engine.  
 */
function getCurrentDebugpyPort(): Promise<number | null> {
    return new Promise((resolve, reject) => {
        const getCurrentDebugpyPortScript = utils.FPythonScriptFiles.getAbsPath(utils.FPythonScriptFiles.getCurrentDebugpyPort);

        remoteHandler.executeFile(getCurrentDebugpyPortScript, {}, (message: RemoteExecutionMessage) => {
            const outputs = message.getCommandResultOutput();

            for (let output of outputs) {
                if (output.type === FCommandOutputType.info) {
                    const port = Number(output.output);
                    resolve(port);
                }
            }

            resolve(null);
        });
    });
}


/**
 * pip install the "debugpy" python module
 * @param callback The function to call once the module has been installed
 * @param target The directory where to install the module, if none is provided it'll be installed in the current Unreal Project
 */
function installDebugpy(target = ""): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const installDebugpyScript = utils.FPythonScriptFiles.getAbsPath(utils.FPythonScriptFiles.installDebugPy);

        // Pass along the target to the python script as a global variable
        const globals = { "install_dir": target };  // eslint-disable-line @typescript-eslint/naming-convention

        remoteHandler.executeFile(installDebugpyScript, globals, (message: RemoteExecutionMessage) => {
            const outputs = message.getCommandResultOutput();

            // We should've recived a response with "True" or "False"
            for (let output of outputs) {
                if (output.type === FCommandOutputType.info) {
                    resolve(output.output.toLowerCase() === "true");
                    return;
                }
            }

            resolve(false);
        });
    });
}


// ------------------------------------------------------------------------------------------
//                                  Attach to Unreal Engine
// ------------------------------------------------------------------------------------------

/**
 * Start a debugpy server in Unreal Engine.
 * @param port The port to start the server on
 */
function startDebugpyServer(port: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const startDebugServerScript = utils.FPythonScriptFiles.getAbsPath(utils.FPythonScriptFiles.startDebugServer);

        const globals = { "debug_port": port };  // eslint-disable-line @typescript-eslint/naming-convention

        remoteHandler.executeFile(startDebugServerScript, globals, (message: RemoteExecutionMessage) => {
            const outputs = message.getCommandResultOutput();

            for (let output of outputs) {
                if (output.type === FCommandOutputType.info) {
                    resolve(output.output.toLowerCase() === "true");
                    return;
                }
            }

            resolve(false);
        });
    });

}

/**
 * Start a python debug session and attach VS Code to a port
 * @param port The port to connect to
 */
function startVsCodeDebugModeSession(port: number) {
    vscode.debug.startDebugging(undefined, {
        "name": utils.DEBUG_SESSION_NAME,
        "type": "python",
        "request": "attach",
        "port": port,
        "host": "localhost",
        "rules": [{ "module": utils.FPythonScriptFiles.execute, "include": false }], // Make sure the execute module isn't debugged
    });
}


/** Attach VS Code to Unreal Engine */
export async function main() {
    // Make sure debugpy is installed
    let bInstalled = await isDebugpyInstalled();
    if (!bInstalled) {
        const selectedInstallOption = await vscode.window.showWarningMessage(
            "Python module 'debugpy' is required for debugging",
            "Install"
        );

        if (selectedInstallOption === "Install") {
            bInstalled = await installDebugpy();

            if (!bInstalled) {
                const selectedErrorOption = await vscode.window.showErrorMessage(
                    "Failed to install debugpy, please install it manually and make sure it's in the sys.path for Unreal Engine",
                    "View on pypi.org"
                );

                if (selectedErrorOption === "View on pypi.org") {
                    utils.openUrl("https://pypi.org/project/debugpy/");
                }
            }
        }
    }

    if (!bInstalled) {
        return;
    }

    const config = utils.getExtensionConfig();
    const configPort: number | undefined = config.get("debug.port");
    if (!configPort) {
        return;
    }

    let attachPort = await getCurrentDebugpyPort();
    if (!attachPort) {
        if (config.get("strictPort")) {
            if (await utils.isPortAvailable(configPort)) {
                attachPort = configPort;
            }
            else {
                vscode.window.showErrorMessage(`Port ${configPort} is currently busy. Please update the 'config ue-python.debug.port'.`);
            }
        }
        else {
            attachPort = await utils.findFreePort(configPort, 101);
            if (!attachPort) {
                vscode.window.showErrorMessage(`All ports between ${configPort} -> ${configPort + 100} are busy. Please update the 'config ue-python.debug.port'.`);
            }
        }

        if (attachPort) {
            if (await startDebugpyServer(attachPort)) {
                startVsCodeDebugModeSession(attachPort);
            }
        }
    }
    else {
        startVsCodeDebugModeSession(attachPort);
    }
}