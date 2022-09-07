import * as vscode from 'vscode';

import * as https from 'https';
import * as path  from 'path';
import * as os    from "os";
import * as fs    from 'fs';

const TEMPFOLDER_NAME = "VSCode-Unreal-Python-Utils";
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
    const filepath = path.join(getExtentionTempDir(), filename);
    fs.writeFileSync(filepath, text);
    return filepath;
}


/**
 * @returns The workspace configuration for this extension _('motionbuilder')_
 */
 export function getExtensionConfig() {
    return vscode.workspace.getConfiguration("unreal-engine-python");
}