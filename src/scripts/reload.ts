import * as vscode from 'vscode';

import * as remoteHandler from '../modules/remote-handler';
import * as logger from '../modules/logger';
import * as utils from '../modules/utils';


interface IReloadResponse {
    num_reloads: number;
    time: number;
    num_failed: number;
}

let isCommandRegistered = false;

export async function reload() {
    const disposableStatusMessage = vscode.window.setStatusBarMessage("$(sync~spin) Reloading modules...", 5000);

    const workspaceFolders = vscode.workspace.workspaceFolders?.map(folder => folder.uri.fsPath) || [];

    const attachScript = utils.FPythonScriptFiles.getUri(utils.FPythonScriptFiles.reload);
    const response = await remoteHandler.evaluateFunction(attachScript, "reload",
        {
            "workspace_folders": workspaceFolders,
        }
    );

    disposableStatusMessage.dispose();

    if (!response)
        return;

    let parsedResults: IReloadResponse;
    try {
        parsedResults = JSON.parse(response.result.slice(1, -1));
    } catch (e) {
        logger.showError("Failed to parse JSON response from reload script", e as Error);
        return;
    }

    if (parsedResults.num_failed <= 0) {
        vscode.window.setStatusBarMessage(`$(check) Reloaded ${parsedResults.num_reloads} modules in ${parsedResults.time} ms`, 3500);
    }
    else if (!isCommandRegistered) {
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 5);
        statusBarItem.text = `$(error) Failed to reload ${parsedResults.num_failed} module${parsedResults.num_failed === 1 ? '' : 's'}`;
        statusBarItem.command = "ue-python.showReloadErrorMessage";
        statusBarItem.color = new vscode.ThemeColor('errorForeground');

        const timeout = setTimeout(() => {
            commandDisposable.dispose();
            statusBarItem.dispose();
            isCommandRegistered = false;
        }, 5000);
        
        const commandDisposable = vscode.commands.registerCommand(statusBarItem.command, () => {
            logger.getOutputChannel().show();
            commandDisposable.dispose();
            statusBarItem.dispose();
            clearTimeout(timeout);
            isCommandRegistered = false;
        });

        statusBarItem.show();

        isCommandRegistered = true;
    }
}
