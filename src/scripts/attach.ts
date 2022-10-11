import * as vscode from 'vscode';

import * as remoteHandler from '../modules/remote-handler';
import * as utils from '../modules/utils';

import { RemoteExecutionMessage, FCommandOutputType } from "../modules/remote-execution";


// ------------------------------------------------------------------------------------------
//                               Installation of debugpy
// ------------------------------------------------------------------------------------------

/**
 * Check if the python module "debugpy" is installed and accessible with the current `sys.paths` in Unreal Engine.  
 * @param callback The function to call once Unreal has responded
 */
function isDebugpyInstalled(callback: (bInstalled: boolean) => void) {
    const isDebugPyInstalledScript = utils.FPythonScriptFiles.getAbsPath(utils.FPythonScriptFiles.isDebugpyInstalled);

    remoteHandler.executeFile(isDebugPyInstalledScript, {}, (message: RemoteExecutionMessage) => {
        const outputs = message.getCommandResultOutput();

        for (let output of outputs) {
            if (output.type === FCommandOutputType.info) {
                callback(output.output.toLowerCase() === "true");
                return;
            }
        }

        callback(false);
    });
}


/**
 * pip install the "debugpy" python module
 * @param callback The function to call once the module has been installed
 * @param target The directory where to install the module, if none is provided it'll be installed in the current Unreal Project
 */
function installDebugpy(callback: (bSuccess: boolean) => void, target = "") {
    const installDebugpyScript = utils.FPythonScriptFiles.getAbsPath(utils.FPythonScriptFiles.installDebugPy);

    // Pass along the target to the python script as a global variable
    const globals = { "install_dir": target };  // eslint-disable-line @typescript-eslint/naming-convention

    remoteHandler.executeFile(installDebugpyScript, globals, (message: RemoteExecutionMessage) => {
        const outputs = message.getCommandResultOutput();

        // We should've recived a response with "True" or "False"
        for (let output of outputs) {
            if (output.type === FCommandOutputType.info) {
                callback(output.output.toLowerCase() === "true");
                return;
            }
        }

        callback(false);
    });
}


// ------------------------------------------------------------------------------------------
//                                  Attach to Unreal Engine
// ------------------------------------------------------------------------------------------

/**
 * Start a debugpy server in Unreal Engine.
 * @param port The port to start the server on
 * @param callback Function to call once the server has started
 */
function startDebugpyServer(port: number, callback: (bSuccess: boolean) => void) {
    const startDebugServerScript = utils.FPythonScriptFiles.getAbsPath(utils.FPythonScriptFiles.startDebugServer);

    const globals = { "debug_port": port };  // eslint-disable-line @typescript-eslint/naming-convention

    remoteHandler.executeFile(startDebugServerScript, globals, (message: RemoteExecutionMessage) => {
        const outputs = message.getCommandResultOutput();

        for (let output of outputs) {
            if (output.type === FCommandOutputType.info) {
                callback(output.output.toLowerCase() === "true");
                return;
            }
        }

        callback(false);
    });
}


/**
 * Attach VS Code to Unreal Engine, this will start a debugpy server
 */
function attachToUnreal() {
    const port: number | undefined = utils.getExtensionConfig().get("debug.port");
    if (!port) {
        return;
    }

    // Start the debugpy server
    startDebugpyServer(port, bSuccess => {
        if (bSuccess) {
            // Attach VS Code to the debugpy server
            vscode.debug.startDebugging(undefined, {
                "name": utils.DEBUG_SESSION_NAME,
                "type": "python",
                "request": "attach",
                "port": port,
                "host": "localhost",
                "rules": [{ "module": utils.FPythonScriptFiles.execute, "include": false }], // Make sure the execute module isn't debugged
            });
        }
    });
}


/** Attach VS Code to Unreal Engine */
export async function main() {
    // Make sure debugpy is installed
    isDebugpyInstalled(async bInstalled => {
        if (bInstalled) {
            attachToUnreal();
        }
        else {
            // Ask user to install debugpy
            const selectedInstallOption = await vscode.window.showWarningMessage(
                "Python module 'debugpy' is required for debugging",
                "Install"
            );

            if (selectedInstallOption === "Install") {
                // Install debugpy
                installDebugpy(async bSuccess => {
                    if (bSuccess) {
                        attachToUnreal();
                    }
                    else {
                        // Installation of debugpy failed, ask user to install it manually instead
                        const selectedErrorOption = await vscode.window.showErrorMessage(
                            "Failed to install debugpy, please install it manually and make sure it's in the sys.path for Unreal Engine",
                            "View on pypi.org"
                        );

                        if (selectedErrorOption === "View on pypi.org") {
                            utils.openUrl("https://pypi.org/project/debugpy/");
                        }
                    }
                });
            }
        }
    });
}