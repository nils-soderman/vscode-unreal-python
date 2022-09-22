import * as vscode from 'vscode';
import * as execute from './scripts/execute';
import * as utils from './modules/utils';

export function activate(context: vscode.ExtensionContext) {


	context.subscriptions.push(
		vscode.commands.registerCommand('unreal-engine-python.execute', () => {
			execute.execute();
		})
	);

}

// this method is called when your extension is deactivated
export function deactivate() { 
	// Remove all temp files created by this extension
	utils.cleanupTempFiles();
}
