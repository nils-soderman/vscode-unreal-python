import * as vscode from 'vscode';

import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

import * as remoteHandler from '../modules/remote-handler';
import * as utils from '../modules/utils';


import { ECommandOutputType } from "unreal-remote-execution";

enum EInOutCommands {
    getTableOfContents = "getTableOfContents",
    getDocPage = "getDocPage",
    getDropDownAreaOpenStates = "getDropDownAreaOpenStates",
    getMaxListItems = "getMaxListItems",
    getInitialFilter = "getInitialFilter"
}

enum EOutCommands {
}

enum EInCommands {
    storeDropDownAreaOpenState = "storeDropDownAreaOpenState",
    storeMaxListItems = "storeMaxListItems"
}

enum EConfigFiles {
    dropDownAreaStates = "documentation_dropDownArea_states.json"
}


/**
 * Open the documentation in a new tab
 * @param extensionUri The extension's Uri
 */
export function openDocumentationWindow(extensionUri: vscode.Uri) {
    // Check if a single word is selected in the editor, and if so use that as the default filter
    let defaultFilter: string | undefined = undefined;
    const editor = vscode.window.activeTextEditor;
    if (editor?.selections.length === 1) {
        const selectedText = editor.document.getText(editor.selection);
        if (selectedText) {
            const words = selectedText.trim().split(" ");
            if (words.length === 1) {
                const selectedWord = words[0];

                // Make sure the word does not contain any special characters
                if (selectedWord.match(/^[a-zA-Z0-9_]+$/)) {
                    defaultFilter = selectedWord;
                }
            }
        }
    }

    // Create the documentation pannel and open it
    const documentationPannel = new DocumentationPannel(extensionUri);
    documentationPannel.open(vscode.ViewColumn.Two, defaultFilter);

    return documentationPannel;
}


/**
 *  
 */
async function buildDocumentationTableOfContents(filepath: string): Promise<boolean> {
    const buildDocumentationTocScirpt = utils.FPythonScriptFiles.getAbsPath(utils.FPythonScriptFiles.buildDocumentationToC);

    const globals = {
        "outFilepath": filepath
    };

    const response = await remoteHandler.executeFile(buildDocumentationTocScirpt, globals);
    if (response) {
        for (let output of response.output.reverse()) {
            if (output.type === ECommandOutputType.INFO) {
                return output.output.trim().toLowerCase() === "true";
            }
        }

    }

    return false;
}


/**
 *  
 */
async function buildPageContent(filepath: string, module: string): Promise<boolean> {
    const getDocPageContentScirpt = utils.FPythonScriptFiles.getAbsPath(utils.FPythonScriptFiles.getDocPageContent);

    const globals = {
        "object": module,
        "outFilepath": filepath
    };

    const response = await remoteHandler.executeFile(getDocPageContentScirpt, globals);
    if (response) {
        for (let output of response.output.reverse()) {
            if (output.type === ECommandOutputType.INFO) {
                return output.output.trim().toLowerCase() === "true";
            }
        }
    }

    return false;
}



export class DocumentationPannel {

    private readonly pannelName = "UE-Python-Documentation";
    readonly title = "Unreal Engine Python";

    private readonly webviewDirectory;
    private pannel?: vscode.WebviewPanel;

    private dropDownAreaStates: { [id: string]: boolean } = {};
    private maxListItems: { [id: string]: number } = {};
    private initialFilter: string | undefined = undefined;


    constructor(
        private readonly _extensionUri: vscode.Uri
    ) {
        this.webviewDirectory = vscode.Uri.joinPath(_extensionUri, 'webview-ui', "build");
    }

    /**
     * Open the documentation pannel in a new tab
     * @param viewColumn The view column to open the pannel in
     * @param defaultFilter The default filter to insert into the search bar
     */
    public open(viewColumn = vscode.ViewColumn.Two, defaultFilter?: string) {
        // Set/Load some default values
        this.initialFilter = defaultFilter;
        this.dropDownAreaStates = utils.loadConfigFile(EConfigFiles.dropDownAreaStates, true, {});

        this.pannel = vscode.window.createWebviewPanel(this.pannelName, this.title, viewColumn, {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        });

        this.pannel.webview.onDidReceiveMessage(data => { this.onDidReceiveMessage(data); });
        this.pannel.webview.html = this.getHtmlForWebview(this.pannel.webview);
    }


    public async sendTableOfContents() {
        const filepath = path.join(utils.getExtentionTempDir(), "documentation_toc.json");
        // Build table of content if it doesn't already exists
        if (!fs.existsSync(filepath)) {
            if (!await buildDocumentationTableOfContents(filepath)) {
                return;
            }
        }
        const tableOfContentsString = fs.readFileSync(filepath);
        const data = JSON.parse(tableOfContentsString.toString());

        if (this.pannel) {
            this.pannel.webview.postMessage({ command: EInOutCommands.getTableOfContents, data: data });
        }

    }


    public async openDetailsPage(module: string, property?: string) {
        const filepath = path.join(utils.getExtentionTempDir(), `docpage_${module}.json`);
        if (!fs.existsSync(filepath)) {
            await buildPageContent(filepath, module);
        }

        const tableOfContentsString = fs.readFileSync(filepath);
        const data = JSON.parse(tableOfContentsString.toString());

        if (this.pannel) {
            this.pannel.webview.postMessage({ command: EInOutCommands.getDocPage, data: { pageData: data, property: property } });
        }
    }


    private onDidReceiveMessage(data: any) {
        switch (data.command) {
            case EInOutCommands.getTableOfContents:
                {
                    this.sendTableOfContents();
                    break;
                }
            case EInOutCommands.getDocPage:
                {
                    this.openDetailsPage(data.data.object, data.data.property);
                    break;
                }
            case EInCommands.storeDropDownAreaOpenState:
                {
                    this.storeDropDownAreaOpenState(data.data.id, data.data.value);
                    break;
                }
            case EInOutCommands.getDropDownAreaOpenStates:
                {
                    this.pannel?.webview.postMessage({ command: EInOutCommands.getDropDownAreaOpenStates, data: this.dropDownAreaStates });
                    break;
                }
            case EInCommands.storeMaxListItems:
                {
                    this.maxListItems[data.data.id] = data.data.value;
                    break;
                }
            case EInOutCommands.getMaxListItems:
                {
                    this.pannel?.webview.postMessage({ command: EInOutCommands.getMaxListItems, data: this.maxListItems });
                    break;
                }
            case EInOutCommands.getInitialFilter:
                {
                    this.pannel?.webview.postMessage({ command: EInOutCommands.getInitialFilter, data: this.initialFilter });
                    this.initialFilter = undefined;
                    break;
                }
            default:
                throw new Error(`Not implemented: ${this.pannelName} recived an unknown command: '${data.command}'`);
        }
    }

    private storeDropDownAreaOpenState(id: string, value: boolean) {
        this.dropDownAreaStates[id] = value;

        utils.saveConfigFile(EConfigFiles.dropDownAreaStates, this.dropDownAreaStates);
    }

    private getHtmlForWebview(webview: vscode.Webview) {
        // Use a nonce to only allow a specific script to be run.
        const nonce = crypto.randomUUID().replace(/-/g, "");

        // Read the manifest file to locate the required script and style files
        const manifest = require(path.join(this.webviewDirectory.fsPath, 'asset-manifest.json'));
        const mainScript = manifest['files']['main.js'];
        const mainStyle = manifest['files']['main.css'];

        // Get default stylesheet
        let stylesheetUris = [];
        stylesheetUris.push(
            webview.asWebviewUri(vscode.Uri.joinPath(this.webviewDirectory, mainStyle))
        );

        let scritpUris = [];
        scritpUris.push(
            webview.asWebviewUri(vscode.Uri.joinPath(this.webviewDirectory, mainScript))
        );

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
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
				${styleSheetString}
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https:; script-src 'nonce-${nonce}';style-src vscode-resource: 'unsafe-inline' http: https: data:;">
				<base href="${webview.asWebviewUri(this.webviewDirectory)}/">
			</head>
			<body>
				<noscript>You need to enable JavaScript to run this app.</noscript>
				<div id="root"></div>
				${scriptsString}
			</body>
			</html>`;
    }
}