import * as vscode from 'vscode';

const OUTPUT_CHANNEL_NAME = "UE Python Log";
let outputChannel: vscode.LogOutputChannel;


export function getOutputChannel() {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME, { log: true });
    }
    return outputChannel;
}


/**
 * Log a message to the output channel
 * @param message The message to log
 */
export function info(message: string) {
    getOutputChannel().info(message);
}

export function warn(message: string) {
    getOutputChannel().warn(message);
}

export function error(message: string) {
    getOutputChannel().error(message);
}


/**
 * Show an error message to the user and log the error.message
 * @param message The message to show to the user in the error dialog
 * @param error The full error message to log
 */
export function showError(message: string, error?: Error) {
    const outputChannel = getOutputChannel();

    if (error)
        outputChannel.error(error.message);

    const OPTION_SHOW_LOG = "Show Log";
    vscode.window.showErrorMessage(message, OPTION_SHOW_LOG).then((value) => {
        if (value === OPTION_SHOW_LOG) {
            outputChannel.show();
        }
    });
}
