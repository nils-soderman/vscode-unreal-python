import * as vscode from 'vscode';

import * as tcpPortUsed from 'tcp-port-used';
import * as path from 'path';
import * as open from 'open';
import * as os from "os";
import * as fs from 'fs';


const DATA_FOLDER_NAME = "VSCode-Unreal-Python";  // Folder name used for Temp & Data directory
export const DEBUG_SESSION_NAME = "Unreal Python"; // The name of the debug session when debugging Unreal

export const EXTENSION_DIR = path.dirname(path.dirname(__dirname));  // The base directory of where this extension is installed
export const EXTENSION_PYTHON_DIR = path.join(EXTENSION_DIR, "python");  // The directory where all python scritps provided by this extension can be founnd


/**
 * Struct containing all available python script's provided by this extension.  
 * All variables & methods are static, this class should not be instantiated.
 */
export class FPythonScriptFiles {
    static readonly execute = "vscode_execute";
    static readonly executeEntry = "vscode_execute_entry";
    static readonly isDebugpyInstalled = "debug/is_debugpy_installed";
    static readonly installDebugPy = "debug/install_debugpy";
    static readonly startDebugServer = "debug/start_debug_server";
    static readonly getCurrentDebugpyPort = "debug/current_debugy_port";
    static readonly codeCompletionGetPath = "setup_code_completion/get_stub_path";
    static readonly isDevmodeEnabled = "setup_code_completion/is_devmode_enabled";
    static readonly buildDocumentationToC = "documentation/build_toc";
    static readonly getDocPageContent = "documentation/get_page_content";

    /** Get the absolute path to one of the scripts defined in this struct */
    static getAbsPath(file: string) {
        return path.join(EXTENSION_PYTHON_DIR, `${file}.py`);
    }
}


// -----------------------------------------------------------------------------------------
//                                  VS Code Utils
// -----------------------------------------------------------------------------------------

/**
 * @returns The workspace configuration for this extension _('ue-python')_
 */
export function getExtensionConfig() {
    // Try to get the active workspace folder first, to have it read Folder Settings
    let workspaceFolder;
    if (vscode.window.activeTextEditor) {
        const activeDocumenet = vscode.window.activeTextEditor.document;
        workspaceFolder = vscode.workspace.getWorkspaceFolder(activeDocumenet.uri);
    }

    return vscode.workspace.getConfiguration("ue-python", workspaceFolder);
}


/** Check if we're currently attached to an Unreal instance */
export function isDebuggingUnreal() {
    return vscode.debug.activeDebugSession !== undefined && vscode.debug.activeDebugSession.name === DEBUG_SESSION_NAME;
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
 * Make sure a path uses forward slashes
 */
export function ensureForwardSlashes(inPath: string) {
    return inPath.replace(/\\/g, "/");;
}


/**
 * @param bEnsureExists If folder doesn't exist, create it
 * @returns absolute path to this extensions tempdir
 */
export function getExtentionTempDir(bEnsureExists = true) {
    const tempDir = path.join(os.tmpdir(), DATA_FOLDER_NAME);
    if (bEnsureExists && !fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }
    return tempDir;
}


/** 
 * @param bEnsureExists If folder doesn't exist, create it
 * @returns The directory where to save extension data 
 * */
export function getExtensionConfigDir(bEnsureExists = true) {
    let configDir: string | undefined;
    if (process.platform === 'win32') {
        // Windows
        configDir = process.env.APPDATA;
    }
    else if (process.platform === 'darwin') {
        // Mac OS
        configDir = path.join(os.homedir(), 'Library');
    }
    else {
        // Linux
        configDir = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'));
    }

    if (!configDir) {
        return;
    }

    configDir = path.join(configDir, DATA_FOLDER_NAME);

    // Create folder if it doesn't exists
    if (bEnsureExists && !fs.existsSync(configDir)) {
        fs.mkdirSync(configDir);
    }

    return configDir;
}


/**
 * Write a temp file inside of this extensions temp directory
 * @param filename The basename of the file
 * @param text Text to write to the file
 * @returns the absolute filepath of the file
 */
export function saveTempFile(filename: string, text: string | object) {
    if (!path.isAbsolute(filename)) {
        filename = path.join(getExtentionTempDir(), filename);
    }

    if (typeof text === "object") {
        text = JSON.stringify(text);
    }

    fs.writeFileSync(filename, text);

    return filename;
}


export function saveConfigFile(filename: string, text: string | object) {
    if (!path.isAbsolute(filename)) {
        const configDir = getExtensionConfigDir(true);
        if (!configDir) {
            return;
        }

        filename = path.join(configDir, filename);
    }

    if (typeof text === "object") {
        text = JSON.stringify(text);
    }

    fs.writeFileSync(filename, text);

    return filename;
}


export function loadConfigFile(filename: string, bParseJson = false, defaultValue: any = undefined) {
    if (!path.isAbsolute(filename)) {
        const configDir = getExtensionConfigDir(true);
        if (!configDir) {
            return defaultValue;
        }
        filename = path.join(configDir, filename);
    }

    if (!fs.existsSync(filename)) {
        return defaultValue;
    }

    const content = fs.readFileSync(filename, { encoding: "utf-8" });
    if (bParseJson) {
        return JSON.parse(content);
    }
    return content;
}

/**
 * Delete this extension's temp folder (and all of the files inside of it)
 */
export function cleanupTempFiles() {
    const tempDir = getExtentionTempDir();
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
    }
}


// -----------------------------------------------------------------------------------------
//                                          Web
// -----------------------------------------------------------------------------------------

/** Open a url in the default webbrowser */
export function openUrl(url: string) {
    open(url);
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
    for (let i = 0; i < num; i++) {
        const port = startPort + i;
        if (await isPortAvailable(port, host)) {
            return port;
        }
    }

    return null;
}