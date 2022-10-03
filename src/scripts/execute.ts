import * as vscode from 'vscode';

import * as path from 'path';
import * as uuid from 'uuid';
import * as fs from 'fs';

import * as utils from '../modules/utils';

import * as remoteHandler from "../modules/remote-handler";
import * as vsCodeExec from "../modules/code-exec";

import { RemoteExecutionMessage } from "../modules/remote-execution";

const PYTHON_EXEC_FILE = path.join(utils.EXTENSION_PYTHON_DIR, "vscode_execute_entry.py");

const INPUT_DATA_FILENAME = "exec-in-data";
const INPUT_TEMP_PYTHON_FILENAME = "exec-in-code";
const OUTPUT_FILENAME = "exec-out";

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


function getOutputFilepath(commandId: string) {
    return path.join(utils.getExtentionTempDir(), `${OUTPUT_FILENAME}-${commandId}.txt`);
}


function getTempPythonInputFilepath(commandId: string) {
    return path.join(utils.getExtentionTempDir(), `${INPUT_TEMP_PYTHON_FILENAME}-${commandId}.py`);
}

function getInputDataFilepath(commandId: string) {
    return path.join(utils.getExtentionTempDir(), `${INPUT_DATA_FILENAME}-${commandId}.json`);
}


function readResponse(commandId: string) {
    const outputFilename = getOutputFilepath(commandId);
    if (fs.existsSync(outputFilename)) {
        return fs.readFileSync(outputFilename).toString("utf8");
    }
    return "";
}


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

async function cleanUpTempFiles(commandId: string) {
    const filepaths = [
        getTempPythonInputFilepath(commandId),
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



export async function execute() {
    if (!vscode.window.activeTextEditor) {
        return;
    }
    const activeDocuemt = vscode.window.activeTextEditor.document;

    // Generate a random command id, used to differentiate from other commands run at the same time
    const commandId = uuid.v4();

    const fileToExecute = vsCodeExec.getFileToExecute(getTempPythonInputFilepath(commandId));
    if (!fileToExecute) {
        return;
    }

    const extensionConfig = utils.getExtensionConfig();

    // File an info file telling mb what script to run, etc.
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

    let globalVariables: any = {};
    globalVariables["__vscodeExecFile__"] = PYTHON_EXEC_FILE;
    globalVariables[DATA_FILEPATH_GLOBAL_VAR_NAME] = dataFilepath;

    remoteHandler.executeFile(PYTHON_EXEC_FILE, globalVariables, (message: RemoteExecutionMessage) => { handleResponse(message, commandId); });
}