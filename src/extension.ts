import * as vscode from 'vscode';

import * as remoteHandler from './modules/remote-handler';
import * as utils from './modules/utils';

import * as setupCodeCompletion from './scripts/setup-code-completion';
import * as execute from './scripts/execute';
import * as attach from './scripts/attach';
import { openDocumentationWindow } from './views/documentation-pannel';

export function activate(context: vscode.ExtensionContext) {


	// Register views
	// const provider = new SidebarViewProvier(context.extensionUri);

	// context.subscriptions.push(
	// 	vscode.window.registerWebviewViewProvider('ue-python.documentation', provider)
	// );


	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand('ue-python.execute', () => {
			execute.main();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('ue-python.attach', () => {
			attach.main();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('ue-python.setupCodeCompletion', () => {
			setupCodeCompletion.main();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('ue-python.openDocumentation', () => {
			openDocumentationWindow(context.extensionUri);
		})
	);

}


export function deactivate() {
	// Remove all temp files created by this extension
	utils.cleanupTempFiles();

	// Close command connection
	remoteHandler.closeRemoteConnection();
}
