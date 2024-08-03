import * as vscode from 'vscode';

import * as utils from '../modules/utils';

/**
 * This function needs to be called before the tests are run
 * `setExtensionUri` is normally called in the extension activation method.
 */
export function initializeExtension() {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder)
        throw new Error("No workspace folder found");
    const extensionDir = vscode.Uri.joinPath(folder.uri, "..", "..");
    utils.setExtensionUri(extensionDir);
}

export function getPythonTestFilepath(filename: string): vscode.Uri {
    return vscode.Uri.joinPath(utils.getExtensionUri(), "test", "fixtures", filename);
}

export async function uriExists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch (error) {
        return false;
    }
}