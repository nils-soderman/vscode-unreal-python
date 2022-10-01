import * as vscode from 'vscode';

import * as remoteHandler from './modules/remote-handler';
import * as execute from './scripts/execute';
import * as utils from './modules/utils';


export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(
		vscode.commands.registerCommand('ue-python.execute', () => {
			execute.execute();
		})
	);

}


export function deactivate() { 
	// Remove all temp files created by this extension
	utils.cleanupTempFiles();

	// Close command connection
	remoteHandler.closeRemoteConnection();
}
