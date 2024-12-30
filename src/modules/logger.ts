import * as vscode from 'vscode';

const OUTPUT_CHANNEL_NAME = "UE Python Log";
let outputChannel: vscode.OutputChannel;


function getOutputChannel() {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
    }
    return outputChannel;
}


/**
 * Log a message to the output channel
 * @param message The message to log
 */
export function log(message: string) {
    const date = new Date();
    getOutputChannel().appendLine(`[${date.toLocaleTimeString()}] ${message}`);
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
 * @param error The full error message to log
 */
export function logError(message: string, error: Error) {
    log(error.toString());

    const OPTION_SHOW_LOG = "Show Log";
    vscode.window.showErrorMessage(message, OPTION_SHOW_LOG).then((value) => {
        if (value === OPTION_SHOW_LOG) {
            show();
        }
    });
}