import * as vscode from 'vscode';

import * as remoteHandler from './modules/remote-handler';
import * as utils from './modules/utils';

import * as setupCodeCompletion from './scripts/setup-code-completion';
import * as documentationPannel from './views/documentation-pannel';
import * as selectInstance from './scripts/select-instance';
import * as execute from './scripts/execute';
import * as attach from './scripts/attach';
import * as reload from './scripts/reload';


export function activate(context: vscode.ExtensionContext) {
	// Set the extension directory
	utils.setExtensionUri(context.extensionUri);

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
			return documentationPannel.openDocumentationWindow(context.extensionUri, context.globalStorageUri);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('ue-python.selectInstance', () => {
			selectInstance.main();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('ue-python.reloadModules', () => {
			reload.reload();
		})
	);

	// Check if config is changed
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(onConfigurationChanged)
	);
}


export async function deactivate() {
	remoteHandler.removeStatusBarItem();

	await Promise.all([
		remoteHandler.closeRemoteConnection(),
		utils.cleanupTempFiles()
	]);
}


function onConfigurationChanged(event: vscode.ConfigurationChangeEvent) {
	// Check if we need to restart the remote execution instance
	const restartOnProperties = [
		'remote.multicastGroupEndpoint',
		'remote.commandEndpoint',
		'remote.multicastTTL',
		'remote.multicastBindAdress',
		'environment.addWorkspaceToPath'
	];

	for (const property of restartOnProperties) {
		if (event.affectsConfiguration(`ue-python.${property}`)) {
			remoteHandler.closeRemoteConnection();
			break;
		}
	}
}