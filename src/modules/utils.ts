import * as vscode from 'vscode';

import * as path from 'path';
import * as os from "os";
import * as fs from 'fs';

const TEMPFOLDER_NAME = "VSCode-Unreal-Python";
const PYTHON_MODULES_FOLDER_NAME = "python-modules";
export const DEBUG_SESSION_NAME = "Unreal Python";
export const EXTENSION_DIR = path.dirname(path.dirname(__dirname));
export const EXTENSION_PYTHON_DIR = path.join(EXTENSION_DIR, "python");
export const EXTENSION_RESOURCES_DIR = path.join(EXTENSION_DIR, "resources");


/**
 * @param bEnsureExists If folder doesn't exist, create it
 * @returns absolute path to this extensions tempdir
 */
export function getExtentionTempDir(bEnsureExists = true) {
    const tempDir = path.join(os.tmpdir(), TEMPFOLDER_NAME);
    if (bEnsureExists && !fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }
    return tempDir;
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


/**
 * @returns The workspace configuration for this extension _('unreal-engine-python')_
 */
export function getExtensionConfig() {
    return vscode.workspace.getConfiguration("unreal-engine-python");
}

/** Check if we're currently attached to an Unreal instance */
export function isDebuggingUnreal() {
    return vscode.debug.activeDebugSession && vscode.debug.activeDebugSession.name === DEBUG_SESSION_NAME;
}