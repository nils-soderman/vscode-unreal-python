import * as vscode from 'vscode';

import * as path from 'path';
import * as open from 'open';
import * as os from "os";
import * as fs from 'fs';

const DATA_FOLDER_NAME = "VSCode-Unreal-Python";
const PYTHON_MODULES_FOLDER_NAME = "python-modules";
export const DEBUG_SESSION_NAME = "Unreal Python";
export const EXTENSION_DIR = path.dirname(path.dirname(__dirname));
export const EXTENSION_PYTHON_DIR = path.join(EXTENSION_DIR, "python");
export const EXTENSION_RESOURCES_DIR = path.join(EXTENSION_DIR, "resources");


// -----------------------------------------------------------------------------------------
//                                  VS Code Utils
// -----------------------------------------------------------------------------------------

/**
 * @returns The workspace configuration for this extension _('ue-python')_
 */
export function getExtensionConfig() {
    return vscode.workspace.getConfiguration("ue-python");
}


/** Check if we're currently attached to an Unreal instance */
export function isDebuggingUnreal() {
    return vscode.debug.activeDebugSession !== undefined && vscode.debug.activeDebugSession.name === DEBUG_SESSION_NAME;
}


// -----------------------------------------------------------------------------------------
//                              Directories & Files
// -----------------------------------------------------------------------------------------


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
 * @returns The directory path to save application configs 
 */
function getConfigDir() {
    if (process.platform === 'win32') {
        // Windows
        return process.env.APPDATA;
    }

    if (process.platform === 'darwin') {
        // Mac OS
        return path.join(os.homedir(), 'Library');
    }

    // Linux
    return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'));
}


export function getExtensionConfigDir() {
    const configDir = getConfigDir();
    if (!configDir) {
        return;
    }

    return path.join(configDir, DATA_FOLDER_NAME);
}


/**
 * Write a temp file inside of this extensions temp directory
 * @param filename The basename of the file
 * @param text Text to write to the file
 * @returns the absolute filepath of the file
 */
export function saveTempFile(filename: string, text: string) {
    if (!path.isAbsolute(filename)) {
        filename = path.join(getExtentionTempDir(), filename);
    }
    fs.writeFileSync(filename, text);
    return filename;
}


/**
 * Delete the temp folder created by this extension (and all of the files inside of it)
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

export function openUrl(url: string) {
    open(url);
}