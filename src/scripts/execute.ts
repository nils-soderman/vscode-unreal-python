/**
 * Script that executes the selected text in Unreal Engine, if nothing is selected the entire active document will be executed.
 */

import * as vscode from 'vscode';

import * as path from 'path';
import * as uuid from 'uuid';
import * as fs from 'fs';

import * as utils from '../modules/utils';

import * as remoteHandler from "../modules/remote-handler";
import * as vsCodeExec from "../modules/code-exec";

import { RemoteExecutionMessage } from "../modules/remote-execution";


const INPUT_TEMP_PYTHON_FILENAME = "temp_exec";
const OUTPUT_FILENAME = "exec-out";

let gOutputChannel: vscode.OutputChannel | undefined;


/**
 * Get the output channel for this extension
 * @param bEnsureChannelExists If channel doesn't exist, create it
 */
function getOutputChannel(bEnsureChannelExists = true) {
    if (!gOutputChannel && bEnsureChannelExists) {
        gOutputChannel = vscode.window.createOutputChannel("UE Python");
    }
    return gOutputChannel;
}


// ------------------------------------------------------------------------------------------
//                                    Filepaths
// ------------------------------------------------------------------------------------------

/** 
 * Get the filepath where the output for a spesific command will be saved
 * @param commandId: The command ID will be appended to the filename
 */
function getOutputFilepath(commandId: string) {
    return path.join(utils.getExtentionTempDir(), `${OUTPUT_FILENAME}-${commandId}.txt`);
}


/**
 * Get a filepath where a temp python file can be saved
 * @param commandId: The command ID will be appended to the filename
 */
function getTempPythonExecFilepath(commandId: string) {
    return path.join(utils.getExtentionTempDir(), `${INPUT_TEMP_PYTHON_FILENAME}-${commandId}.py`);
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
        getTempPythonExecFilepath(commandId),
        getOutputFilepath(commandId)
    ];

    for (const filepath of filepaths) {
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
    }
}

/** 
 * Read the output file, written by the 'vscode_execute.py' python module 
 * @param commandId: The ID of which response to read
 */
function readResponse(commandId: string) {
    const outputFilename = getOutputFilepath(commandId);
    if (fs.existsSync(outputFilename)) {
        // Use slice to remove the last '\n' always added
        return fs.readFileSync(outputFilename).toString("utf8").slice(0, -2);
    }
    return "";
}


// ------------------------------------------------------------------------------------------
//                                  Remote Exec
// ------------------------------------------------------------------------------------------

/** 
 * Handle data recived from the Unreal python server  
 * Because 'vscode_execute.py' re-directs all of the output through a .txt file, `message` will be empty,
 * instead use `readResponse` to fetch the output. 
 * */
function handleResponse(message: RemoteExecutionMessage, commandId: string) {
    // If user is debugging MB, all output will automatically be appended to the debug console
    if (utils.isDebuggingUnreal()) {
        return;
    }

    // Read the output message
    const parsedOutputMessage = readResponse(commandId);


    const outputChannel = getOutputChannel();
    if (outputChannel) {
        // Add the message to the output channel
        outputChannel.appendLine(parsedOutputMessage);

        // Bring up the output channel on screen
        if (utils.getExtensionConfig().get("execute.showOutput")) {
            outputChannel.show(true);
        }
    }

    // Cleanup all temp that were written by this command
    cleanUpTempFiles(commandId);
}


export async function main() {
    if (!vscode.window.activeTextEditor) {
        return;
    }

    // Generate a random id, used to differentiate from other commands run at the same time
    const commandId = uuid.v4();

    // Get a file to execute
    const tempExecFilepath = getTempPythonExecFilepath(commandId);
    const fileToExecute = vsCodeExec.getFileToExecute(tempExecFilepath);
    if (!fileToExecute) {
        return;
    }

    const extensionConfig = utils.getExtensionConfig();

    // Clear the output channel if enabled in user settings
    if (extensionConfig.get("execute.clearOutput")) {
        const outputChannel = getOutputChannel(false);
        if (outputChannel) {
            outputChannel.clear();
        }
    }

    // Write an info file telling mb what script to run, etc.
    const bIsDebugging = utils.isDebuggingUnreal();
    const nameVar: string | undefined = extensionConfig.get("execute.name");

    let vscodeData: any = {
        "file": fileToExecute,
        "__file__": vscode.window.activeTextEditor.document.uri.fsPath,  // eslint-disable-line @typescript-eslint/naming-convention
        "__name__": nameVar,  // eslint-disable-line @typescript-eslint/naming-convention
        "id": commandId,
        "isDebugging": bIsDebugging,
        "additionalPrint": ">>>"
    };

    // Set `vscodeData` as a global dict variable, that can be read by the python script
    const globalVariables = { "vscode_globals": JSON.stringify(vscodeData) };  // eslint-disable-line @typescript-eslint/naming-convention

    const execFile = utils.FPythonScriptFiles.getAbsPath(utils.FPythonScriptFiles.executeEntry);
    remoteHandler.executeFile(execFile, globalVariables, (message: RemoteExecutionMessage) => { handleResponse(message, commandId); });
}