import * as vscode from 'vscode';

import * as path from 'path';

import * as remoteHandler from '../modules/remote-handler';
import * as utils from '../modules/utils';

import { RemoteExecutionMessage, FCommandOutputType } from "../modules/remote-execution";


const PYTHON_DEBUG_SCRIPTS_DIR = path.join(utils.EXTENSION_PYTHON_DIR, "debug");
const PYTHON_EXEC_MODULE_NAME = "vscode_execute";

class FDebugScriptFiles {
    static readonly isDebugpyInstalled = "is_debugpy_installed";
    static readonly installDebugPy = "install_debugpy";
    static readonly startDebugServer = "start_debug_server";

    static getAbsPath(file: string) {
        return path.join(PYTHON_DEBUG_SCRIPTS_DIR, `${file}.py`);
    }
}


// ------------------------------------------------------------------------------------------
//                               Installation of debugpy
// ------------------------------------------------------------------------------------------


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


async function installDebugpy(callback: (bSucess: boolean) => void) {
    const installDebugpyScript = FDebugScriptFiles.getAbsPath(FDebugScriptFiles.installDebugPy);

    const globals = { "installDir": "" };
    remoteHandler.executeFile(installDebugpyScript, globals, (message: RemoteExecutionMessage) => {
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



// ------------------------------------------------------------------------------------------
//                                  Attach to Unreal Engine
// ------------------------------------------------------------------------------------------

function startDebugpyServer(port: number, callback: (bSuccess: boolean) => void) {
    const startDebugServerScript = FDebugScriptFiles.getAbsPath(FDebugScriptFiles.startDebugServer);

    const globals = { "debug_port": port };
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


export async function attachToUnreal() {

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
                    installDebugpy(bSucess => {

                        if (bSucess) {
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