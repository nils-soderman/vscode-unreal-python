import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel;

function getOutputChannel() {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel("UE Python Log");
    }
    return outputChannel;
}


/**
 * Log a message to the output channel
 * @param message The message to log
 */
export function log(message: string) {
    getOutputChannel().appendLine(message);
}


/**
 * Show the output channel to the user
 */
export function show() {
    getOutputChannel().show(true);
}


/**
 * Show an error message to the user and log the full error message
 * @param message The message to show to the user in the error dialog
 * @param fullLog The full error message to log
 */
export function logError(message: string, fullLog: Error) {
    log(fullLog.toString());

    vscode.window.showErrorMessage(message, "Show Log").then((value) => {
        if (value === "Show Log") {
            show();
        }
    });
}