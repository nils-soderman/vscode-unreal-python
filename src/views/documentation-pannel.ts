import * as vscode from 'vscode';

import * as crypto from 'crypto';
import * as path from 'path';

import * as remoteHandler from '../modules/remote-handler';
import * as logging from '../modules/logger';
import * as utils from '../modules/utils';


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
export async function openDocumentationWindow(extensionUri: vscode.Uri, globalStorageUri: vscode.Uri, viewColumn = vscode.ViewColumn.Two): Promise<DocumentationPannel> {
    // Check if a single word is selected in the editor, and if so use that as the default filter
    let defaultFilter: string | undefined = undefined;
    const editor = vscode.window.activeTextEditor;

    if (editor?.selections.length === 1) {
        const selectedText = editor.document.getText(editor.selection);
        const words = selectedText.trim().split(" ");
        if (words.length === 1 && /^[a-zA-Z0-9_]+$/.test(words[0])) {
            defaultFilter = words[0];
        }
    }

    // Create the documentation pannel and open it
    const documentationPannel = new DocumentationPannel(extensionUri, globalStorageUri);
    await documentationPannel.open(viewColumn, defaultFilter);

    return documentationPannel;
}


/**
 * Get the table of contents for the documentation
 * @returns The table of contents as a JSON object
 */
async function getTableOfContents() {
    const getTableOfContentScript = utils.FPythonScriptFiles.getUri(utils.FPythonScriptFiles.buildDocumentationToC);

    const response = await remoteHandler.evaluateFunction(getTableOfContentScript, "get_table_of_content_json");
    if (response && remoteHandler.logResponseAndReportErrors(response, "Failed to get documentation")) {
        // As the result is stringified JSON, remove the quotes and parse it
        const result = response.result.replace(/^'|'$/g, '');
        try {
            return JSON.parse(result);
        }
        catch (e) {
            logging.log(result);
            logging.logError("Failed to parse JSON", e as Error);
        }
    }

    return false;
}


/**
 *  
 */
async function getPageContent(module: string) {
    const getDocPageContentScirpt = utils.FPythonScriptFiles.getUri(utils.FPythonScriptFiles.getDocPageContent);

    const kwargs = {
        "object_name": module
    };

    const response = await remoteHandler.evaluateFunction(getDocPageContentScirpt, "get_object_documentation_json", kwargs);
    if (response && remoteHandler.logResponseAndReportErrors(response, "Failed to get documentation")) {
        // As the result is stringified JSON, make it parsable
        const result = response.result.replace(/^'|'$/g, '').replace(/\\'/g, '\'').replace(/\\\\/g, '\\');
        try {
            return JSON.parse(result);
        }
        catch (e) {
            logging.log(result);
            logging.logError("Failed to parse JSON", e as Error);
        }
    }
}



export class DocumentationPannel {
    private readonly pannelName = "UE-Python-Documentation";
    readonly title = "Unreal Engine Python";

    private pannel?: vscode.WebviewPanel;

    private tableOfContentsCache: any = {};

    private dropDownAreaStates: { [id: string]: boolean } = {};
    private maxListItems: { [id: string]: number } = {};
    private initialFilter: string | undefined = undefined;


    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly globalStorage: vscode.Uri
    ) { }

    /**
     * Open the documentation pannel in a new tab
     * @param viewColumn The view column to open the pannel in
     * @param defaultFilter The default filter to insert into the search bar
     */
    public async open(viewColumn = vscode.ViewColumn.Two, defaultFilter?: string) {
        // Set/Load some default values
        this.initialFilter = defaultFilter;
        this.dropDownAreaStates = await this.loadDropDownAreaOpenState();

        this.pannel = vscode.window.createWebviewPanel(this.pannelName, this.title, viewColumn, {
            enableScripts: true,
            localResourceRoots: [
                this.extensionUri
            ]
        });

        this.pannel.webview.onDidReceiveMessage(data => { this.onDidReceiveMessage(data); });
        this.pannel.webview.html = this.getWebviewHtml(this.pannel.webview);
    }


    public async sendTableOfContents() {
        if (Object.keys(this.tableOfContentsCache).length === 0)
            this.tableOfContentsCache = await getTableOfContents();

        if (this.pannel) {
            this.pannel.webview.postMessage({ command: EInOutCommands.getTableOfContents, data: this.tableOfContentsCache });
        }
    }


    public async openDetailsPage(module: string, property?: string) {
        const data = await getPageContent(module);

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
        const dropDownStatesStorage = vscode.Uri.joinPath(this.globalStorage, EConfigFiles.dropDownAreaStates);
        return vscode.workspace.fs.writeFile(dropDownStatesStorage, Buffer.from(JSON.stringify(this.dropDownAreaStates)));
    }

    private async loadDropDownAreaOpenState() {
        const dropDownStatesStorage = vscode.Uri.joinPath(this.globalStorage, EConfigFiles.dropDownAreaStates);
        if (await utils.uriExists(dropDownStatesStorage)) {
            const data = await vscode.workspace.fs.readFile(dropDownStatesStorage);
            return JSON.parse(data.toString());
        }

        return {};
    }

    private getWebviewHtml(webview: vscode.Webview) {
        const webviewDirectory = vscode.Uri.joinPath(this.extensionUri, 'webview-ui', "build");

        // Read the manifest file to locate the required script and style files
        const manifest = require(path.join(webviewDirectory.fsPath, 'asset-manifest.json'));
        const mainScript = manifest['files']['main.js'];
        const mainStyle = manifest['files']['main.css'];

        // Get default stylesheet
        let stylesheetUris = [];
        stylesheetUris.push(
            webview.asWebviewUri(vscode.Uri.joinPath(webviewDirectory, mainStyle))
        );

        let scritpUris = [];
        scritpUris.push(
            webview.asWebviewUri(vscode.Uri.joinPath(webviewDirectory, mainScript))
        );

        let styleSheetString = "";
        for (const stylesheet of stylesheetUris) {
            styleSheetString += `<link href="${stylesheet}" rel="stylesheet">\n`;
        }

        // Use a nonce to only allow a specific script to be run.
        const nonce = crypto.randomUUID().replace(/-/g, "");

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
				<base href="${webview.asWebviewUri(webviewDirectory)}/">
			</head>
			<body>
				<noscript>You need to enable JavaScript to run this app.</noscript>
				<div id="root"></div>
				${scriptsString}
			</body>
			</html>`;
    }
}
