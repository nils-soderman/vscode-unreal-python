import * as vscode from 'vscode';

import * as tcpPortUsed from 'tcp-port-used';
import * as path from 'path';
import * as os from "os";

export const EXTENSION_ID = "ue-python";

const DATA_FOLDER_NAME = "VSCode-Unreal-Python";  // Folder name used for Temp & Data directory
const DEBUG_SESSION_NAME = "Unreal Python"; // The name of the debug session when debugging Unreal


let _extensionDir: vscode.Uri | undefined; // Stores the absolute path to this extension's directory, set on activation

/**
 * This function should only be called once, on activation
 * @param uri Should be: `ExtensionContext.extensionPath`
 */
export function setExtensionUri(uri: vscode.Uri) {
    _extensionDir = uri;
}

/**
 * This function cannot be called in top-level. It must be called after the extension has been activated
 * @returns The absolute path to this extension's directory
 */
export function getExtensionUri(): vscode.Uri {
    if (!_extensionDir) {
        throw Error("Extension Dir hasn't been set yet! This should be set on activation. This function cannot be called in top-level.");
    }
    return _extensionDir;
}


/**
 * Struct containing all available python script's provided by this extension.  
 * All variables & methods are static, this class should not be instantiated.
 */
export class FPythonScriptFiles {
    static readonly buildDocumentationToC = "documentation/build_toc";
    static readonly getDocPageContent = "documentation/get_page_content";
    static readonly getStubPath = "get_stub_path";
    static readonly addSysPath = "add_sys_path";
    static readonly attach = "attach";
    static readonly execute = "execute";
    static readonly reload = "reload";
    static readonly eval = "vsc_eval";

    /** Get the absolute path to one of the scripts defined in this struct */
    static getUri(file: string): vscode.Uri {
        return vscode.Uri.joinPath(getExtensionUri(), "python", `${file}.py`);
    }
}


// -----------------------------------------------------------------------------------------
//                                  VS Code Utils
// -----------------------------------------------------------------------------------------

/**
 * Get the workspace folder for the currently active file/text editor
 */
export function getActiveWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    if (vscode.window.activeTextEditor) {
        const activeDocumenet = vscode.window.activeTextEditor.document;
        return vscode.workspace.getWorkspaceFolder(activeDocumenet.uri);
    }
}


/**
 * @returns The workspace configuration for this extension _('ue-python')_
 */
export function getExtensionConfig() {
    const activeWorkspaceFolder = getActiveWorkspaceFolder()?.uri;
    return vscode.workspace.getConfiguration(EXTENSION_ID, activeWorkspaceFolder);
}

export function getDebugSessionName(projectName: string) {
    return `${DEBUG_SESSION_NAME} - ${projectName}`;
}

/** Check if we're currently attached to an Unreal instance */
export function isDebuggingUnreal(projectName: string) {
    return vscode.debug.activeDebugSession !== undefined && vscode.debug.activeDebugSession.name === getDebugSessionName(projectName);
}


// -----------------------------------------------------------------------------------------
//                              Directories, Files & Paths
// -----------------------------------------------------------------------------------------


/**
 * Compare two paths and check if they are pointing to the same file/directory
 * Regardless of case sensitivity, forward or backward slashes etc. 
 */
export function isPathsSame(a: string, b: string) {
    return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}


/**
 * @param bEnsureExists If folder doesn't exist, create it
 * @returns absolute path to this extensions tempdir
 */
export async function getExtensionTempUri(bEnsureExists = true): Promise<vscode.Uri> {
    const tempUri = vscode.Uri.file(os.tmpdir());
    const extensionTmpUri = vscode.Uri.joinPath(tempUri, DATA_FOLDER_NAME);
    if (bEnsureExists && !await uriExists(tempUri)) {
        await vscode.workspace.fs.createDirectory(tempUri);
    }

    return extensionTmpUri;
}

export async function uriExists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}


/**
 * Delete this extension's temp folder (and all of the files inside of it)
 */
export async function cleanupTempFiles() {
    const tmpDir = await getExtensionTempUri();
    if (await uriExists(tmpDir)) {
        await vscode.workspace.fs.delete(tmpDir, { recursive: true, useTrash: false });
    }
}


// -----------------------------------------------------------------------------------------
//                                          Misc
// -----------------------------------------------------------------------------------------


/** 
 * Check if a port is taken 
 * @param port The port to check
 * @param host The ip, will default to localhost
 */
export async function isPortAvailable(port: number, host?: string) {
    return !await tcpPortUsed.check(port, host);
}


/**  
 * Check the ports between `startPort` -> `startPort + num`, and return the first one that's free
 * @param startPort The port to start itterating from
 * @param num How many ports to check
 * @param host The ip, will default to localhost
 * @returns The port as a number, or `null` if all ports were taken
 */
export async function findFreePort(startPort: number, num: number, host?: string) {
    for (let i = 0; i < num + 1; i++) {
        const port = startPort + i;
        if (await isPortAvailable(port, host)) {
            return port;
        }
    }

    return null;
}


let gOutputChannel: vscode.OutputChannel | undefined;

/**
 * Get the output channel for this extension
 * @param bEnsureChannelExists If channel doesn't exist, create it
 */
export function getOutputChannel(bEnsureExists?: true): vscode.OutputChannel;
export function getOutputChannel(bEnsureExists?: false): vscode.OutputChannel | undefined;

export function getOutputChannel(bEnsureChannelExists = true) {
    if (!gOutputChannel && bEnsureChannelExists) {
        gOutputChannel = vscode.window.createOutputChannel("UE Python");
    }
    return gOutputChannel;
}