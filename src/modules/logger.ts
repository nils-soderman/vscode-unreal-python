import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel;

function getOutputChannel() {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel("UE Python Log");
    }
    return outputChannel;
}


export function log(message: string) {
    getOutputChannel().appendLine(message);
}