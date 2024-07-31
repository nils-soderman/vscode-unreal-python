/**
 * Script to attach VS Code to Unreal Engine by starting a debugpy server
 * If debugpy is not installed user will be prompted to install it, with an option to automatically install it
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as path from 'path';

import * as remoteHandler from '../modules/remote-handler';
import * as logger from '../modules/logger';
import * as utils from '../modules/utils';

import { ECommandOutputType } from "unreal-remote-execution";


const DEBUGPY_PYPI_URL = "https://pypi.org/project/debugpy/";
const REPORT_BUG_URL = "https://github.com/nils-soderman/vscode-unreal-python/issues";

// ------------------------------------------------------------------------------------------
//                                  Interfaces
// ------------------------------------------------------------------------------------------

/**
 * Settings for attaching to Unreal Engine.
 */
interface IAttachConfiguration {
    port: number;
    justMyCode: boolean;
};


// ------------------------------------------------------------------------------------------
//                               Installation of debugpy
// ------------------------------------------------------------------------------------------

/**
 * Check if the python module "debugpy" is installed and accessible with the current `sys.paths` in Unreal Engine.  
 */
export async function isDebugpyInstalled(): Promise<boolean> {
    logger.log("Checking if debugpy is installed...");

    const isDebugPyInstalledScript = utils.FPythonScriptFiles.getUri(utils.FPythonScriptFiles.isDebugpyInstalled);
    const response = await remoteHandler.executeFile(isDebugPyInstalledScript, {});
    if (response) {
        for (const output of response.output) {
            if (output.type === ECommandOutputType.INFO) {
                if (output.output.trim().toLowerCase() === "true") {
                    logger.log("debugpy python module found");
                    return true;
                }
            }
        }
    }

    logger.log("debugpy python module could not be found");

    return false;
}


/**
 * Check if the python module "debugpy" is installed and accessible with the current `sys.paths` in Unreal Engine.  
 */
export async function getCurrentDebugpyPort(): Promise<number | null> {
    const getCurrentDebugpyPortScript = utils.FPythonScriptFiles.getUri(utils.FPythonScriptFiles.getCurrentDebugpyPort);

    logger.log("Checking if debugpy is currently running...");

    const response = await remoteHandler.executeFile(getCurrentDebugpyPortScript, {});
    if (response) {
        for (const output of response.output) {
            if (output.type === ECommandOutputType.INFO) {
                const port = Number(output.output);

                if (port) {
                    logger.log(`debugpy is already running on port ${port}`);
                    return port;
                }

            }
        }
    }

    logger.log("debugpy is currently not running");

    return null;
}


/**
 * pip install the "debugpy" python module
 * @param callback The function to call once the module has been installed
 * @param target The directory where to install the module, if none is provided it'll be installed in the current Unreal Project
 */
export async function installDebugpy(target?: vscode.Uri): Promise<boolean> {
    logger.log("Installing debugpy...");

    const installDebugpyScript = utils.FPythonScriptFiles.getUri(utils.FPythonScriptFiles.installDebugPy);

    // Generate a random id that we expect as a response from the python script if the installation was successful
    const successId = crypto.randomUUID();

    // Pass along the target to the python script as a global variable
    const globals = {
        "install_dir": target?.fsPath, // eslint-disable-line @typescript-eslint/naming-convention
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

    logger.log("Failed to install python module `debugpy`");
    logger.logError(`Failed to install [debugpy](${DEBUGPY_PYPI_URL}), consider installing it manually.`, new Error(errorMessage));

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
    const startDebugServerScript = utils.FPythonScriptFiles.getUri(utils.FPythonScriptFiles.startDebugServer);

    const globals = { "debug_port": port };  // eslint-disable-line @typescript-eslint/naming-convention

    logger.log(`Starting debugpy server on port ${port}`);

    const response = await remoteHandler.executeFile(startDebugServerScript, globals);
    for (const output of response?.output ?? []) {
        if (output.type === ECommandOutputType.INFO) {
            return output.output.trim().toLowerCase() === "true";
        }
    }

    logger.log("Failed to start debugpy server");
    return false;
}


/**
 * Start a python debug session and attach VS Code to a port
 * @param attachSettings Launch settings for the debug session
 */
function attach(attachSettings: IAttachConfiguration) {
    const moduleToIgnore = path.basename(utils.FPythonScriptFiles.execute);

    const configuration = {
        "name": utils.DEBUG_SESSION_NAME,
        "type": "python",
        "request": "attach",
        "host": "localhost",
        "rules": [{ "module": moduleToIgnore, "include": false }], // Make sure the execute module isn't debugged
        ...attachSettings
    };

    logger.log(`Attaching to Unreal Engine with the following config:\n${JSON.stringify(configuration, null, 4)}`);

    return vscode.debug.startDebugging(undefined, configuration);
}


/** Attach VS Code to Unreal Engine */
export async function main(): Promise<boolean> {
    // Make sure debugpy is installed
    const bInstalled = await isDebugpyInstalled();
    if (!bInstalled) {
        const selectedInstallOption = await vscode.window.showWarningMessage(
            `Python module [debugpy](${DEBUGPY_PYPI_URL}) is required for debugging`,
            "Install"
        );

        if (selectedInstallOption === "Install") {
            if (!await installDebugpy())
                return false;
        }
        else {
            return false;
        }
    }

    const config = utils.getExtensionConfig();
    const attachConfig = config.get<IAttachConfiguration>("attach");
    if (!attachConfig) {
        return;
    }

    // TODO: Remove in the next release
    // Check if the deprecated port setting is used
    const deprecatedPortConfig = config.inspect("debug.port");
    const deprecatedPortValue = config.get<number>("debug.port");
    if (deprecatedPortValue && deprecatedPortConfig?.defaultValue !== deprecatedPortValue) {
        if (config.inspect("attach.port")?.defaultValue === attachConfig.port) {
            attachConfig.port = deprecatedPortValue;
            vscode.window.showWarningMessage("The 'ue-python.debug.port' setting is deprecated, please use 'ue-python.attach.port' instead.");
        }
    }

    // Check if debugpy is already running
    const currentPort = await getCurrentDebugpyPort();
    if (currentPort) {
        attachConfig.port = currentPort;
        attach(attachConfig);
    }
    else {
        // If "strictPort" is enabled, make sure the port specified is available
        const reservedCommandPort = await remoteHandler.getRemoteExecutionCommandPort();
        if (config.get<boolean>("strictPort")) {
            if (!(await utils.isPortAvailable(attachConfig.port)) || reservedCommandPort === attachConfig.port) {
                logger.log(`Port ${attachConfig.port} is currently busy.`);
                vscode.window.showErrorMessage(`Port ${attachConfig.port} is currently busy. Please update the 'config ue-python.attach.port'.`);
                return false;
            }
        }
        else {
            // Find a free port as close to the specified port as possible
            const startPort = reservedCommandPort === attachConfig.port ? attachConfig.port + 1 : attachConfig.port;
            const freePort = await utils.findFreePort(startPort, 100);
            if (!freePort) {
                logger.log(`All ports between ${attachConfig.port} -> ${attachConfig.port + 100} are busy.`);
                vscode.window.showErrorMessage(`All ports between ${attachConfig.port} -> ${attachConfig.port + 100} are busy. Please update the 'config ue-python.attach.port'.`);
                return false;
            }

            attachConfig.port = freePort;
        }

        // Start the debugpy server and attach to it
        if (await startDebugpyServer(attachConfig.port)) {
            return attach(attachConfig);
        }
    }

    return false;
}
