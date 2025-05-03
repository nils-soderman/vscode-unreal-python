/**
 * Script that executes the selected text in Unreal Engine, if nothing is selected the entire active document will be executed.
 */

import * as vscode from 'vscode';

import * as crypto from 'crypto';

import * as utils from '../modules/utils';
import * as logger from '../modules/logger';

import * as remoteHandler from "../modules/remote-handler";
import * as vsCodeExec from "../modules/code-exec";

import { IRemoteExecutionMessageCommandOutputData } from "unreal-remote-execution";


const INPUT_TEMP_PYTHON_FILENAME = "temp_exec";


// ------------------------------------------------------------------------------------------
//                                    Filepaths
// ------------------------------------------------------------------------------------------

/**
 * Get a filepath where a temp python file can be saved
 * @param commandId: The command ID will be appended to the filename
 */
async function getTempPythonExecFilepath(commandId: string): Promise<vscode.Uri> {
    return vscode.Uri.joinPath(await utils.getExtensionTempUri(), `${INPUT_TEMP_PYTHON_FILENAME}-${commandId}.py`);
}


// ------------------------------------------------------------------------------------------
//                                     File handlers
// ------------------------------------------------------------------------------------------

/**
 * Clean up all temp files related to a spesific command 
 * @param commandId The ID of which files to delete
 */
async function cleanUpTempFiles(commandId: string) {
    const filepaths = [
        await getTempPythonExecFilepath(commandId),
    ];

    for (const filepath of filepaths) {
        if (await utils.uriExists(filepath)) {
            vscode.workspace.fs.delete(filepath, { useTrash: false });
        }
    }
}


// ------------------------------------------------------------------------------------------
//                                  Remote Exec
// ------------------------------------------------------------------------------------------

/** 
 * Handle the response recived from Unreal
 */
function handleResponse(message: IRemoteExecutionMessageCommandOutputData, commandId: string, isDebugging: boolean) {
    if (!message.success) {
        logger.showError("Failed to execute code", Error(message.result));
        return;
    }

    // If user is debugging, all output will automatically be appended to the debug console
    if (isDebugging) {
        vscode.debug.activeDebugConsole.appendLine(">>>");
        return;
    }
    const outputChannel = utils.getOutputChannel();
    if (!outputChannel) {
        return;
    }

    for (const output of message.output) {
        outputChannel.appendLine(output.output.trimEnd());
    }

    outputChannel.appendLine(">>>");

    if (utils.getExtensionConfig().get("execute.showOutput")) {
        outputChannel.show(true);
    }

    // Cleanup all temp that were written by this command
    cleanUpTempFiles(commandId);
}


export async function main() {
    if (!vscode.window.activeTextEditor) {
        return false;
    }

    // Generate a random id, used to differentiate from other commands run at the same time
    const commandId = crypto.randomUUID();

    // Get a file to execute
    const tempExecFilepath = await getTempPythonExecFilepath(commandId);
    const fileToExecute = await vsCodeExec.getFileToExecute(tempExecFilepath);
    if (!fileToExecute) {
        return false;
    }

    const extensionConfig = utils.getExtensionConfig();

    // Clear the output channel if enabled in user settings
    if (extensionConfig.get<boolean>("execute.clearOutput")) {
        const outputChannel = utils.getOutputChannel(false);
        if (outputChannel) {
            outputChannel.clear();
        }
    }

    const projectName = (await remoteHandler.getRemoteExecutionInstance(false))?.connectedNode?.data.project_name;

    // Write an info file telling mb what script to run, etc.
    const bIsDebugging = projectName !== undefined && utils.isDebuggingUnreal(projectName);
    const nameVar = extensionConfig.get<string>("execute.name");

    let vscodeData: any = {
        "file": fileToExecute.fsPath,
        "__file__": vscode.window.activeTextEditor.document.uri.fsPath,  // eslint-disable-line @typescript-eslint/naming-convention
        "__name__": nameVar,  // eslint-disable-line @typescript-eslint/naming-convention
        // "id": commandId,
        "isDebugging": bIsDebugging,
    };

    // Set `vscodeData` as a global dict variable, that can be read by the python script
    const globalVariables = { "vscode_globals": JSON.stringify(vscodeData) };  // eslint-disable-line @typescript-eslint/naming-convention

    const execFile = utils.FPythonScriptFiles.getUri(utils.FPythonScriptFiles.executeEntry);
    const response = await remoteHandler.executeFile(execFile, globalVariables);
    if (response) {
        handleResponse(response, commandId, bIsDebugging);
        return true;
    }

    return false;
}