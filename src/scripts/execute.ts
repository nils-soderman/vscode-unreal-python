import * as vscode from 'vscode';

import * as path from 'path';
import * as uuid from 'uuid';
import * as fs from 'fs';

import * as utils from '../modules/utils';

import * as remoteHandler from "../modules/remote-handler";
import * as vsCodeExec from "../modules/code-exec";

import { RemoteExecutionMessage } from "../modules/remote-execution";


const INPUT_TEMP_PYTHON_FILENAME = "temp_exec";
const INPUT_DATA_FILENAME = "exec-in-data";
const OUTPUT_FILENAME = "exec-out";

const DATA_FILEPATH_GLOBAL_VAR_NAME = "data_filepath";

let gOutputChannel: vscode.OutputChannel | undefined;


// ------------------------------------------------------------------------------------------
//                                    Filepaths
// ------------------------------------------------------------------------------------------

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


/**
 * Get a filepath where input data can be stored
 * @param commandId 
 * @returns 
 */
function getInputDataFilepath(commandId: string) {
    return path.join(utils.getExtentionTempDir(), `${INPUT_DATA_FILENAME}-${commandId}.json`);
}


// ------------------------------------------------------------------------------------------
//                                     File handlers
// ------------------------------------------------------------------------------------------

/**
 * Clean up all temp files related to a spesific command 
 * @param commandId 
 */
async function cleanUpTempFiles(commandId: string) {
    const filepaths = [
        getTempPythonExecFilepath(commandId),
        getOutputFilepath(commandId),
        getInputDataFilepath(commandId)
    ];

    for (const filepath of filepaths) {
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
    }
}


/**
 * Write a json temp file that can be read by execute.py, to know what script to execute etc.
 * @param fileToExecute The abs filepath to the .py file that should be executed
 * @param originalFilepath The abs filepath to the source filepath, will be used to set the python var `__file__`
 * @param additionalPrint Additional text to be printed to the output once the code has been executed
 */
function writeDataFile(fileToExecute: string, originalFilepath: string, commandId: string, isDebugging: boolean, additionalPrint = "", nameVar = "") {
    let data: any = {
        "file": fileToExecute,
        "__file__": originalFilepath,  // eslint-disable-line @typescript-eslint/naming-convention
        "__name__": nameVar,  // eslint-disable-line @typescript-eslint/naming-convention
        "id": commandId,
        "is_debugging": isDebugging  // eslint-disable-line @typescript-eslint/naming-convention
    };

    if (additionalPrint) {
        data["additionalPrint"] = additionalPrint;
    }

    const outDataFilepath = getInputDataFilepath(commandId);
    utils.saveTempFile(outDataFilepath, JSON.stringify(data));

    return outDataFilepath;
}


function readResponse(commandId: string) {
    const outputFilename = getOutputFilepath(commandId);
    if (fs.existsSync(outputFilename)) {
        return fs.readFileSync(outputFilename).toString("utf8");
    }
    return "";
}


// ------------------------------------------------------------------------------------------
//                                  Remote Exec
// ------------------------------------------------------------------------------------------

/** Handle data recived from the Unreal python server */
function handleResponse(message: RemoteExecutionMessage, commandId: string) {
    // If user is debugging MB, all output will automatically be appended to the debug console
    if (utils.isDebuggingUnreal()) {
        return;
    }

    // Format response
    const parsedOutputMessage = readResponse(commandId);
    let outputMessage = `${parsedOutputMessage}>>>`;

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

    const activeDocuemt = vscode.window.activeTextEditor.document;
    const extensionConfig = utils.getExtensionConfig();

    // Write an info file telling mb what script to run, etc.
    const bIsDebugging = utils.isDebuggingUnreal();
    const additionalPrint = bIsDebugging ? ">>>" : "";
    const nameVar: string | undefined = extensionConfig.get("execute.name");
    const dataFilepath = writeDataFile(fileToExecute, activeDocuemt.uri.fsPath, commandId, bIsDebugging, additionalPrint, nameVar);

    // Clear the output channel if enabled in user settings
    if (extensionConfig.get("execute.clearOutput")) {
        const outputChannel = getOutputChannel(false);
        if (outputChannel) {
            outputChannel.clear();
        }
    }

    const execFile = utils.FPythonScriptFiles.getAbsPath(utils.FPythonScriptFiles.executeEntry);

    let globalVariables: any = {
    };
    globalVariables["__vscodeExecFile__"] = execFile;
    globalVariables[DATA_FILEPATH_GLOBAL_VAR_NAME] = dataFilepath;

    // const globals = {"vscode_globals": JSON.stringify(globalVariables)};  // eslint-disable-line @typescript-eslint/naming-convention
    

    remoteHandler.executeFile(execFile, globalVariables, (message: RemoteExecutionMessage) => { handleResponse(message, commandId); });
}