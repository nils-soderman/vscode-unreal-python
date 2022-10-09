import * as vscode from 'vscode';

import * as remoteHandler from './modules/remote-handler';
import * as execute from './scripts/execute';
import * as utils from './modules/utils';
import * as attach from './scripts/attach';
import * as setupCodeCompletion from './scripts/setup-code-completion';


export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(
		vscode.commands.registerCommand('ue-python.execute', () => {
			execute.execute();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('ue-python.attach', () => {
			attach.attachToUnreal();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('ue-python.setupCodeCompletion', () => {
			setupCodeCompletion.main();
		})
	);

}


export function deactivate() {
	// Remove all temp files created by this extension
	utils.cleanupTempFiles();

	// Close command connection
	remoteHandler.closeRemoteConnection();
}
