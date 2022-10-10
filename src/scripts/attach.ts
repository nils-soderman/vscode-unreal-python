import * as vscode from 'vscode';

import * as path from 'path';

import * as remoteHandler from '../modules/remote-handler';
import * as utils from '../modules/utils';

import { RemoteExecutionMessage, FCommandOutputType } from "../modules/remote-execution";


const PYTHON_DEBUG_SCRIPTS_DIR = path.join(utils.EXTENSION_PYTHON_DIR, "debug"); // The directory with all debug python scripts
const PYTHON_EXEC_MODULE_NAME = "vscode_execute";


/**
 * Struct containing all python files related to debugging
 */
class FDebugScriptFiles {
    static readonly isDebugpyInstalled = "is_debugpy_installed";
    static readonly installDebugPy = "install_debugpy";
    static readonly startDebugServer = "start_debug_server";

    /** Get the absolute path to one of the scripts defined in this struct */
    static getAbsPath(file: string) {
        return path.join(PYTHON_DEBUG_SCRIPTS_DIR, `${file}.py`);
    }
}


// ------------------------------------------------------------------------------------------
//                               Installation of debugpy
// ------------------------------------------------------------------------------------------

/**
 * Check if the python module "debugpy" is installed and accessible with the current `sys.paths` in Unreal Engine.  
 * This function will run a script in Unreal to check.
 * @param callback The function to call once Unreal has responded
 */
function isDebugpyInstalled(callback: (bInstalled: boolean) => void) {
    const isDebugPyInstalledScript = FDebugScriptFiles.getAbsPath(FDebugScriptFiles.isDebugpyInstalled);

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
    const installDebugpyScript = FDebugScriptFiles.getAbsPath(FDebugScriptFiles.installDebugPy);

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
 * @param callback 
 */
function startDebugpyServer(port: number, callback: (bSuccess: boolean) => void) {
    const startDebugServerScript = FDebugScriptFiles.getAbsPath(FDebugScriptFiles.startDebugServer);

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

function attach() {
    const port: number | undefined = utils.getExtensionConfig().get("debug.port");
    if (!port) {
        return;
    }

    startDebugpyServer(port, bSuccess => {
        if (bSuccess) {
            // Attach to the debugpy server
            vscode.debug.startDebugging(undefined, {
                "name": utils.DEBUG_SESSION_NAME,
                "type": "python",
                "request": "attach",
                "port": port,
                "host": "localhost",
                "rules": [{ "module": PYTHON_EXEC_MODULE_NAME, "include": false }], // Make sure the execute module isn't debugged
            });
        }
    });
}


export async function main() {

    // Make sure debugpy is installed
    isDebugpyInstalled((bInstalled: boolean) => {
        if (bInstalled) {
            attach();
        }
        else {
            // Ask user to install debugpy
            vscode.window.showWarningMessage(
                "Python module 'debugpy' is required for debugging",
                "Install"
            ).then(value => {
                if (value === "Install") {

                    // Install debugpy
                    installDebugpy(bSuccess => {

                        if (bSuccess) {
                            attach();
                        }
                        else {
                            // Installation of debugpy failed, ask user to install it manually instead
                            vscode.window.showErrorMessage(
                                "Failed to install debugpy, please install it manually and make sure it's in the sys.path for Unreal Engine",
                                "View on pypi.org"
                            ).then(value => {
                                if (value === "View on pypi.org") {
                                    utils.openUrl("https://pypi.org/project/debugpy/");
                                }
                            });
                        }

                    });

                }
            });
        }
    });

}