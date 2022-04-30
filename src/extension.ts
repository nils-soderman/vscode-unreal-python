import * as vscode from 'vscode';
import * as execute from './execute';

export function activate(context: vscode.ExtensionContext) {


	context.subscriptions.push(
		vscode.commands.registerCommand('unreal-engine-python.helloWorld', () => {
			execute.execute();
		})
	);

}

// this method is called when your extension is deactivated
export function deactivate() { }
