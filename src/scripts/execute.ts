import * as vscode from 'vscode';

import * as path from 'path';
import * as uuid from 'uuid';
import * as fs from 'fs';

import * as utils from '../modules/utils';

import * as remoteHandler from "../modules/remote-handler";
import * as vsCodeExec from "../modules/code-exec";

import { RemoteExecutionMessage } from "../modules/remote-execution";

const TEMP_FILENAME = "vscode_motionbuilder_exec.py";
const TEMP_EXECDATA_FILENAME = "vscode-exec";
const PYTHON_EXEC_FILE = path.join(utils.EXTENSION_PYTHON_DIR, "execute.py");

const OUTPUT_FILEPATH = path.join(utils.getExtentionTempDir(), "vscode-exec-out.txt");

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


/** Check if we're currently attached to a Unreal instance */
function isDebuggingUnreal() {
    return vscode.debug.activeDebugSession && vscode.debug.activeDebugSession.name === utils.DEBUG_SESSION_NAME;
}


function readResponse() {
    if (fs.existsSync(OUTPUT_FILEPATH)) {
        return fs.readFileSync(OUTPUT_FILEPATH).toString("utf8");
    }
    return "";
}



/** Handle data recived from the Unreal python server */
function handleResponse(message: RemoteExecutionMessage) {
    // If user is debugging MB, all output will automatically be appended to the debug console
    if (isDebuggingUnreal()) {
        return;
    }

    // Format response
    let outputMessage = "";
    const parsedOutputMessage = readResponse();
    if (parsedOutputMessage) {
        outputMessage = `${parsedOutputMessage}>>>`;
    }

    // Format response
    outputMessage = outputMessage.replace(/\n\r/g, "\n");

    const outputChannel = getOutputChannel();
    if (outputChannel) {
        // Add the message to the output channel
        outputChannel.appendLine(outputMessage);

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
    const additionalPrint = isDebuggingUnreal() ? ">>>" : "";
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
