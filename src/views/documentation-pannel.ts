import * as vscode from 'vscode';

import * as uuid from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

import * as remoteHandler from '../modules/remote-handler';
import * as utils from '../modules/utils';


import { RemoteExecutionMessage, FCommandOutputType } from "../modules/remote-execution";


/**
 *  
 */
function buildDocumentationTableOfContents(filepath: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const buildDocumentationTocScirpt = utils.FPythonScriptFiles.getAbsPath(utils.FPythonScriptFiles.buildDocumentationToC);

        const globals = {
            "outFilepath": filepath
        };

        remoteHandler.executeFile(buildDocumentationTocScirpt, globals, (message: RemoteExecutionMessage) => {
            const outputs = message.getCommandResultOutput();
            for (let output of outputs.reverse()) {
                if (output.type === FCommandOutputType.info) {
                    resolve(output.output.toLowerCase() === "true");
                    return;
                }
            }

            resolve(false);
        });
    });
}



export class SidebarViewProvier implements vscode.WebviewViewProvider {

    readonly title = "Unreal Engine Python";

    private _view?: vscode.WebviewView;

    private readonly webviewDirectory;
    private readonly pannelName = "sidepanel";

    constructor(
        private readonly _extensionUri: vscode.Uri
    ) {
        this.webviewDirectory = vscode.Uri.joinPath(_extensionUri, 'resources', "webviews");
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,

            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => { this.onDidReceiveMessage(data); });
    }


    public async sendTableOfContents() {
        const filepath = path.join(utils.getExtentionTempDir(), "documentation_toc.json");
        if (await buildDocumentationTableOfContents(filepath)) {
            const tableOfContentsString = fs.readFileSync(filepath);
            const data = JSON.parse(tableOfContentsString.toString());

            if (this._view) {
                // this._view.show?.(true); // `show` is not implemented in 1.49 but is for 1.50 insiders
                this._view.webview.postMessage({ command: 'tableOfContents', data: data });
            }
        }

    }


    private onDidReceiveMessage(data: any) {
        switch (data.command) {
            case 'getTableOfContents':
                {
                    this.sendTableOfContents();
                    break;
                }
            default:
                throw new Error(`Not implemented: ${this.pannelName} recived an unknown command: '${data.command}'`);
        }
    }

    private getHtmlForWebview(webview: vscode.Webview) {
        // Use a nonce to only allow a specific script to be run.
        // const nonce = getNonce();
        const nonce = uuid.v4().replace(/-/g, "");

        // Get default stylesheet
        let stylesheetUris = [];
        stylesheetUris.push(
            webview.asWebviewUri(vscode.Uri.joinPath(this.webviewDirectory, "generic", "css", 'reset.css'))
        );
        stylesheetUris.push(
            webview.asWebviewUri(vscode.Uri.joinPath(this.webviewDirectory, "generic", "css", 'vscode.css'))
        );

        let scritpUris = [];
        scritpUris.push(
            webview.asWebviewUri(vscode.Uri.joinPath(this.webviewDirectory, "generic", 'scripts', 'utils.js'))
        );

        const pannelStyleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.webviewDirectory, this.pannelName, 'main.css'));
        if (fs.existsSync(pannelStyleUri.fsPath)) {
            stylesheetUris.push(pannelStyleUri);
        }

        const pannelScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.webviewDirectory, this.pannelName, 'main.js'));
        if (fs.existsSync(pannelScriptUri.fsPath)) {
            scritpUris.push(pannelScriptUri);
        }

        // Get the HTML content
        const htmlFilepath = webview.asWebviewUri(vscode.Uri.joinPath(this.webviewDirectory, this.pannelName, 'index.html'));
        if (!fs.existsSync(htmlFilepath.fsPath)) {
            throw Error(`Could not find a valid index.html file at: ${htmlFilepath}`);
        }

        const htmlContent = fs.readFileSync(htmlFilepath.fsPath);

        // Convert style & script Uri's to code
        let styleSheetString = "";
        for (const stylesheet of stylesheetUris) {
            styleSheetString += `<link href="${stylesheet}" rel="stylesheet">\n`;
        }

        let scriptsString = "";
        for (const scriptUri of scritpUris) {
            scriptsString += `<script nonce="${nonce}" src="${scriptUri}"></script>\n`;
        }

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${this.title}</title>

                ${styleSheetString}

            </head>
            <body>
                ${htmlContent}
                ${scriptsString}
            </body>
            </html>`;
    }
}