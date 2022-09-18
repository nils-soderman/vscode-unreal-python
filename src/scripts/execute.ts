import * as vscode from 'vscode';

import * as path from 'path';
import * as uuid from 'uuid';

import * as utils from '../modules/utils';

import * as remoteHandler from "../modules/remote-handler";
import * as vsCodeExec from "../modules/code-exec";


const TEMP_FILENAME = "vscode_motionbuilder_exec.py";
const TEMP_EXECDATA_FILENAME = "vscode-exec";
const PYTHON_EXEC_FILE = path.join(utils.EXTENSION_PYTHON_DIR, "execute.py");

const DATA_FILEPATH_GLOBAL_VAR_NAME = "data_filepath";

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


/** Check if we're currently attached to a MotionBuilder instance */
function isDebuggingMotionBuilder() {
    return vscode.debug.activeDebugSession && vscode.debug.activeDebugSession.name === utils.DEBUG_SESSION_NAME;
}


/** Handle data recived from the MotionBuilder python server */
function handleResponse(response: string) {
    // If user is debugging MB, all output will automatically be appended to the debug console
    if (isDebuggingMotionBuilder()) {
        return;
    }

    // Format response
    response = response.replace(/\n\r/g, "\n");

    // Remove the first 2 lines in a traceback message, since those will be related to how this code is executed
    const traceBackString = "Traceback (most recent call last):\n";
    if (response.includes(traceBackString)) {
        const responseTracebackSplit = response.split(traceBackString, 2);
        const tracebackMsg = responseTracebackSplit[1].split("\n").slice(2).join("\n");
        response = responseTracebackSplit[0] + traceBackString + tracebackMsg;
    }


    const outputChannel = getOutputChannel();
    if (outputChannel) {
        // Add the message to the output channel
        outputChannel.appendLine(response);

        // Bring up the output channel on screen
        if (utils.getExtensionConfig().get("execute.showOutput")) {
            outputChannel.show(true);
        }
    }
}


/**
 * Write a json temp file that can be read by MotionBuilder, to know what script to execute etc.
 * @param fileToExecute The abs filepath to the .py file that should be executed
 * @param originalFilepath The abs filepath to the source filepath, will be used to set the python var `__file__`
 * @param additionalPrint Additional text to be printed to the output once the code has been executed
 */
function writeDataFile(fileToExecute: string, originalFilepath: string, additionalPrint = "") {
    let data: any = {};
    data["file"] = fileToExecute;
    data["__file__"] = originalFilepath;
    if (additionalPrint) {
        data["additionalPrint"] = additionalPrint;
    }

    const outFilename = `${TEMP_EXECDATA_FILENAME}-${uuid.v4()}.json`;

    utils.saveTempFile(outFilename, JSON.stringify(data));

    return outFilename;
}



export async function execute() {
    if (!vscode.window.activeTextEditor) {
        return;
    }
    const activeDocuemt = vscode.window.activeTextEditor.document;
    
    const tempFilepath = path.join(utils.getExtentionTempDir(), TEMP_FILENAME);
    const fileToExecute = vsCodeExec.getFileToExecute(tempFilepath);
    if (!fileToExecute) {
        return;
    }

    // File an info file telling mb what script to run, etc.
    const additionalPrint = isDebuggingMotionBuilder() ? ">>>" : "";
    const dataFilepath = writeDataFile(fileToExecute, activeDocuemt.uri.fsPath, additionalPrint);

    // Clear the output channel if enabled in user settings
    if (utils.getExtensionConfig().get("execute.clearOutput")) {
        const outputChannel = getOutputChannel(false);
        if (outputChannel) {
            outputChannel.clear();
        }
    }

    let globalVariables: any = {};
    globalVariables[DATA_FILEPATH_GLOBAL_VAR_NAME] = dataFilepath;
    
    remoteHandler.executeFile(PYTHON_EXEC_FILE, globalVariables, handleResponse);
}
