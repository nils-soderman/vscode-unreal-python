import * as vscode from 'vscode';

import * as remoteHandler from './modules/remote-handler';
import * as utils from './modules/utils';

import * as setupCodeCompletion from './scripts/setup-code-completion';
import * as selectInstance from './scripts/select-instance';
import * as execute from './scripts/execute';
import * as attach from './scripts/attach';

import { openDocumentationWindow } from './views/documentation-pannel';

export function activate(context: vscode.ExtensionContext) {
	// Set the extension directory
	utils.setExtensionDir(context.extensionPath);

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

	context.subscriptions.push(
		vscode.commands.registerCommand('ue-python.selectInstance', () => {
			selectInstance.main();
		})
	);

	// Check if config is changed
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(onConfigurationChanged)
	);
}


export function deactivate() {
	// Remove all temp files created by this extension
	utils.cleanupTempFiles();

	// Close command connection
	remoteHandler.closeRemoteConnection();

	remoteHandler.removeStatusBarItem();
}


function onConfigurationChanged(event: vscode.ConfigurationChangeEvent) {
	// Check if we need to restart the remote execution instance
	const restartOnProperties = ['multicastGroupEndpoint', 'commandEndpoint', 'multicastTTL', 'multicastBindAdress'];
	for (const property of restartOnProperties) {
		if (event.affectsConfiguration(`ue-python.remote.${property}`)) {
			remoteHandler.nullifyRemoteExecutionInstance();
			break;
		}
	}

}