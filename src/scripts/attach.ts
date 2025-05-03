/**
 * Script to attach VS Code to Unreal Engine by starting a debugpy server
 * If debugpy is not installed user will be prompted to install it, with an option to automatically install it
 */

import * as vscode from 'vscode';
import * as path from 'path';

import * as remoteHandler from '../modules/remote-handler';
import * as logger from '../modules/logger';
import * as utils from '../modules/utils';


const DEBUGPY_PYPI_URL = "https://pypi.org/project/debugpy/";

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
    logger.info("Checking if debugpy is installed...");

    const attachScript = utils.FPythonScriptFiles.getUri(utils.FPythonScriptFiles.attach);
    const response = await remoteHandler.evaluateFunction(attachScript, "is_debugpy_installed");
    if (response && response.success)
        return response.result === "True";

    return false;
}


/**
 * Check if the python module "debugpy" is installed and accessible with the current `sys.paths` in Unreal Engine.  
 */
export async function getCurrentDebugpyPort(): Promise<number | null> {
    logger.info("Checking if debugpy is currently running...");

    const attachScript = utils.FPythonScriptFiles.getUri(utils.FPythonScriptFiles.attach);
    const response = await remoteHandler.evaluateFunction(attachScript, "get_current_debugpy_port");
    if (response && response.success) {
        const port = Number(response.result);
        if (port > 0) {
            logger.info(`debugpy is already running on port ${port}`);
            return port;
        }

        logger.info("debugpy is not currently running");
    }

    return null;
}


/**
 * pip install the "debugpy" python module
 */
export async function installDebugpy(): Promise<boolean> {
    logger.info("Installing debugpy...");

    const installDebugpyScript = utils.FPythonScriptFiles.getUri(utils.FPythonScriptFiles.attach);
    const response = await remoteHandler.evaluateFunction(installDebugpyScript, "install_debugpy");
    if (response) {
        if (!response.success && response.result === "True")
            return true;

        logger.showError("Failed to install debugpy", Error(response.result));
    }

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
    logger.info(`Starting debugpy server on port ${port}`);

    const startDebugServerScript = utils.FPythonScriptFiles.getUri(utils.FPythonScriptFiles.attach);
    const response = await remoteHandler.evaluateFunction(startDebugServerScript, "start_debugpy_server", { port });
    if (response && response.success) {
        return response.result === "True";
    }

    return false;
}


/**
 * Start a python debug session and attach VS Code to a port
 * @param attachSettings Launch settings for the debug session
 */
async function attach(name: string, attachSettings: IAttachConfiguration) {
    const moduleToIgnore = path.basename(utils.FPythonScriptFiles.execute);

    const configuration = {
        "name": name,
        "type": "python",
        "request": "attach",
        "host": "localhost",
        "rules": [{ "module": moduleToIgnore, "include": false }], // Make sure the execute module isn't debugged
        ...attachSettings
    };

    logger.info(`Attaching to Unreal Engine with the following config:\n${JSON.stringify(configuration, null, 4)}`);

    return vscode.debug.startDebugging(undefined, configuration);
}


/** Attach VS Code to Unreal Engine */
export async function main(): Promise<boolean> {
    const remoteExecution = await remoteHandler.getConnectedRemoteExecutionInstance();
    const projectName = remoteExecution?.connectedNode?.data.project_name;
    if (!projectName)
        return false;

    if (utils.isDebuggingUnreal(projectName)) {
        logger.info(`Already attached to Unreal Engine project: ${projectName}`);
        return true;
    }

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
        return false;
    }

    const debugSessionName = utils.getDebugSessionName(projectName);

    // Check if debugpy is already running
    const currentPort = await getCurrentDebugpyPort();
    if (currentPort) {
        attachConfig.port = currentPort;
        return attach(debugSessionName, attachConfig);
    }
    else {
        // If "strictPort" is enabled, make sure the port specified is available
        const reservedCommandPort = await remoteHandler.getRemoteExecutionCommandPort();
        if (config.get<boolean>("strictPort")) {
            if (!(await utils.isPortAvailable(attachConfig.port)) || reservedCommandPort === attachConfig.port) {
                logger.info(`Port ${attachConfig.port} is currently busy.`);
                vscode.window.showErrorMessage(`Port ${attachConfig.port} is currently busy. Please update the 'config ue-python.attach.port'.`);
                return false;
            }
        }
        else {
            // Find a free port as close to the specified port as possible
            const startPort = reservedCommandPort === attachConfig.port ? attachConfig.port + 1 : attachConfig.port;
            const freePort = await utils.findFreePort(startPort, 100);
            if (!freePort) {
                logger.info(`All ports between ${attachConfig.port} -> ${attachConfig.port + 100} are busy.`);
                vscode.window.showErrorMessage(`All ports between ${attachConfig.port} -> ${attachConfig.port + 100} are busy. Please update the 'config ue-python.attach.port'.`);
                return false;
            }

            attachConfig.port = freePort;
        }

        // Start the debugpy server and attach to it
        if (await startDebugpyServer(attachConfig.port)) {
            return attach(debugSessionName, attachConfig);
        }
    }

    return false;
}
