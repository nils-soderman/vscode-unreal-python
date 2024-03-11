/**
 * Script to attach VS Code to Unreal Engine by starting a debugpy server
 * If debugpy is not installed user will be prompted to install it, with an option to automatically install it
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as path from 'path';

import * as remoteHandler from '../modules/remote-handler';
import * as utils from '../modules/utils';

import { ECommandOutputType } from "unreal-remote-execution";


const DEBUGPY_PYPI_URL = "https://pypi.org/project/debugpy/";
const REPORT_BUG_URL = "https://github.com/nils-soderman/vscode-unreal-python/issues";

// ------------------------------------------------------------------------------------------
//                                  Types
// ------------------------------------------------------------------------------------------

/**
 * Settings for attaching to Unreal Engine.
 */
type AttachConfiguration = {
    port: number;
    justMyCode: boolean;
};


// ------------------------------------------------------------------------------------------
//                               Installation of debugpy
// ------------------------------------------------------------------------------------------

/**
 * Check if the python module "debugpy" is installed and accessible with the current `sys.paths` in Unreal Engine.  
 */
async function isDebugpyInstalled(): Promise<boolean> {
    const isDebugPyInstalledScript = utils.FPythonScriptFiles.getAbsPath(utils.FPythonScriptFiles.isDebugpyInstalled);

    const response = await remoteHandler.executeFile(isDebugPyInstalledScript, {});
    if (response) {
        for (const output of response.output) {
            if (output.type === ECommandOutputType.INFO) {
                return output.output.trim().toLowerCase() === "true";
            }
        }
    }

    return false;
}


/**
 * Check if the python module "debugpy" is installed and accessible with the current `sys.paths` in Unreal Engine.  
 */
async function getCurrentDebugpyPort(): Promise<number | null> {
    const getCurrentDebugpyPortScript = utils.FPythonScriptFiles.getAbsPath(utils.FPythonScriptFiles.getCurrentDebugpyPort);

    const response = await remoteHandler.executeFile(getCurrentDebugpyPortScript, {});
    if (response) {
        for (const output of response.output) {
            if (output.type === ECommandOutputType.INFO) {
                const port = Number(output.output);
                return port;
            }
        }
    }


    return null;
}


/**
 * pip install the "debugpy" python module
 * @param callback The function to call once the module has been installed
 * @param target The directory where to install the module, if none is provided it'll be installed in the current Unreal Project
 */
async function installDebugpy(target = ""): Promise<boolean> {
    const installDebugpyScript = utils.FPythonScriptFiles.getAbsPath(utils.FPythonScriptFiles.installDebugPy);

    // Generate a random id that we expect as a response from the python script if the installation was successful
    const successId = crypto.randomUUID();

    // Pass along the target to the python script as a global variable
    const globals = {
        "install_dir": target, // eslint-disable-line @typescript-eslint/naming-convention
        "success_id": successId  // eslint-disable-line @typescript-eslint/naming-convention
    };

    const response = await remoteHandler.executeFile(installDebugpyScript, globals);

    // We should've recived a response with "True" or "False"
    let errorMessage = "";
    if (response) {
        for (const output of response.output) {
            if (output.output.trim() === successId)
                return true;

            errorMessage += `${output.output}\n`;
        }
    }

    if (errorMessage) {
        const outputChannel = utils.getOutputChannel(true);
        outputChannel.appendLine(errorMessage);
        outputChannel.show(true);
    }

    vscode.window.showErrorMessage(
        `Failed to install [debugpy](${DEBUGPY_PYPI_URL}), consider installing it manually and make sure it's in the sys.path for Unreal Engine.`,
        "View on pypi.org",
        "Report Bug",
    ).then((value) => {
        if (value === "Report Bug")
            utils.openUrl(REPORT_BUG_URL);

        if (value === "View on pypi.org")
            utils.openUrl(DEBUGPY_PYPI_URL);
    });

    return false;
}

// ------------------------------------------------------------------------------------------
//                                  Attach to Unreal Engine
// ------------------------------------------------------------------------------------------


/**
 * Start a debugpy server in Unreal Engine.
 * @param port The port to start the server on
 */
async function startDebugpyServer(port: number): Promise<boolean> {
    const startDebugServerScript = utils.FPythonScriptFiles.getAbsPath(utils.FPythonScriptFiles.startDebugServer);

    const globals = { "debug_port": port };  // eslint-disable-line @typescript-eslint/naming-convention

    const response = await remoteHandler.executeFile(startDebugServerScript, globals);
    for (const output of response?.output ?? []) {
        if (output.type === ECommandOutputType.INFO) {
            return output.output.trim().toLowerCase() === "true";
        }
    }

    return false;

}


/**
 * Start a python debug session and attach VS Code to a port
 * @param port The port to connect to
 */
function startVsCodeDebugModeSession(attachSettings: AttachConfiguration) {
    const moduleToIgnore = path.basename(utils.FPythonScriptFiles.execute);

    const {port, ...otherSettings } = attachSettings;

    vscode.debug.startDebugging(undefined, {
        "name": utils.DEBUG_SESSION_NAME,
        "type": "python",
        "request": "attach",
        "port": port,
        "host": "localhost",
        "rules": [{ "module": moduleToIgnore, "include": false }], // Make sure the execute module isn't debugged
        ...otherSettings
    });
}


/** Attach VS Code to Unreal Engine */
export async function main() {
    // Make sure debugpy is installed
    let bInstalled = await isDebugpyInstalled();
    if (!bInstalled) {
        const selectedInstallOption = await vscode.window.showWarningMessage(
            `Python module [debugpy](${DEBUGPY_PYPI_URL}) is required for debugging`,
            "Install"
        );

        if (selectedInstallOption === "Install")
            bInstalled = await installDebugpy();
    }

    if (!bInstalled) {
        return;
    }

    const config = utils.getExtensionConfig();
    const attachConfig: AttachConfiguration | undefined = config.get("attach");
    if (!attachConfig) {
        return;
    }


    let attachPort = await getCurrentDebugpyPort();
    if (!attachPort) {
        const reservedCommandPort = await remoteHandler.getRemoteExecutionCommandPort();

        if (config.get("strictPort")) {
            if (await utils.isPortAvailable(attachConfig.port) && reservedCommandPort !== attachConfig.port) {
                attachPort = attachConfig.port;
            }
            else {
                vscode.window.showErrorMessage(`Port ${attachConfig.port} is currently busy. Please update the 'config ue-python.attach.port'.`);
                return;
            }
        }
        else {
            const startPort = reservedCommandPort === attachConfig.port ? attachConfig.port + 1 : attachConfig.port;
            attachPort = await utils.findFreePort(startPort, 101);

            if (attachPort) {
                attachConfig.port = attachPort;
            }
            else {
                vscode.window.showErrorMessage(`All ports between ${attachConfig.port} -> ${attachConfig.port + 100} are busy. Please update the 'config ue-python.attach.port'.`);
                return;
            }
        }

        if (attachPort) {
            if (await startDebugpyServer(attachPort)) {
                startVsCodeDebugModeSession(attachConfig);
            }
        }
    }
    else {
        attachConfig.port = attachPort;

        startVsCodeDebugModeSession(attachConfig);
    }
}
