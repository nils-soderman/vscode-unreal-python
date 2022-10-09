import * as vscode from 'vscode';

import * as path from 'path';
import * as fs from 'fs';

import * as remoteHandler from '../modules/remote-handler';
import * as extensionWiki from '../modules/extension-wiki';
import * as utils from '../modules/utils';

import { RemoteExecutionMessage, FCommandOutputType } from "../modules/remote-execution";


const PYTHON_DEBUG_SCRIPTS_DIR = path.join(utils.EXTENSION_PYTHON_DIR, "setup_code_completion");
const STUB_FILE_NAME = "unreal.py";

const PYTHON_CONFIG = "python";
const EXTRA_PATHS_CONFIG = "analysis.extraPaths";

const STUB_FILE_RELATIVE_FOLDER = "Intermediate/PythonStub";


class FPythonScriptFiles {
    static readonly isDevmodeEnabled = "is_devmode_enabled";
    static readonly getPythonPath = "get_stub_path";
    // static readonly enableDevmode = "enable_devmode";

    static getAbsPath(file: string) {
        return path.join(PYTHON_DEBUG_SCRIPTS_DIR, `${file}.py`);
    }
}


/**
 * Get the configuration for the python extension
 */
function getPythonConfig() {
    return vscode.workspace.getConfiguration(PYTHON_CONFIG);
}

/*
function isDevmodeEnabled(callback: (bEnabled: boolean) => void) {
    const isDevmodeEnabledScript = FPythonScriptFiles.getAbsPath(FPythonScriptFiles.isDevmodeEnabled);
    remoteHandler.executeFile(isDevmodeEnabledScript, {}, (message: RemoteExecutionMessage) => {
        const outputs = message.getCommandResultOutput();
        for (let output of outputs) {
            if (output.type === FCommandOutputType.info) {
                callback(output.output.toLowerCase() === "true");
                return;
            }
        }
        callback(false);
    });
}


function enableDevmode(callback: (bEnabled: boolean) => void) {
    const enableDevmodeScript = FPythonScriptFiles.getAbsPath(FPythonScriptFiles.enableDevmode);
    remoteHandler.executeFile(enableDevmodeScript, {}, (message: RemoteExecutionMessage) => {
        const outputs = message.getCommandResultOutput();
        for (let output of outputs) {
            if (output.type === FCommandOutputType.info) {
                callback(output.output.toLowerCase() === "true");
                return;
            }
        }
        callback(false);
    });
}
*/

function getPythonPath(callback: (path?: string) => void) {
    const getPythonPathScript = FPythonScriptFiles.getAbsPath(FPythonScriptFiles.getPythonPath);
    remoteHandler.executeFile(getPythonPathScript, {}, (message: RemoteExecutionMessage) => {
        const outputs = message.getCommandResultOutput();
        for (let output of outputs) {
            if (output.type === FCommandOutputType.info) {
                callback(output.output);
                return;
            }
        }
        callback();
    });
}


function addPythonAnalysisPath(pathToAdd: string) {
    // Make path use forward slashes
    pathToAdd = pathToAdd.replace(/\\/gi, "/");

    const pythonConfig = getPythonConfig();
    let extraPaths: Array<string> | undefined = pythonConfig.get(EXTRA_PATHS_CONFIG);
    if (extraPaths) {
        const pathsToRemove: string[] = [];
        for (const extraPath of extraPaths) {
            // Make sure the path doesn't already exist
            if (utils.isPathsSame(extraPath, pathToAdd)) {
                return;
            }

            // Check if any other Unreal python paths exists, and if so remove them (if e.g. switching between projects)
            const comparePath = path.resolve(extraPath).toLowerCase().replace(/\\/gi, "/");
            if (comparePath.endsWith(STUB_FILE_RELATIVE_FOLDER.toLowerCase())) {
                pathsToRemove.push(extraPath);
            }
        }

        // Remove any paths
        extraPaths = extraPaths.filter(e => !pathsToRemove.includes(e));

        // Add the path to extraPaths
        extraPaths.push(pathToAdd);
        pythonConfig.update(EXTRA_PATHS_CONFIG, extraPaths, true);
    }
}



async function setupPath(stubFolderPath: string) {
    // Check if a generated stub file exists
    const stubFilepath = path.join(stubFolderPath, STUB_FILE_NAME);
    if (fs.existsSync(stubFilepath)) {
        addPythonAnalysisPath(stubFolderPath);
    }
    else {
        const clickedItem = await vscode.window.showErrorMessage("To setup code completion you first need to enable Developer Mode in Unreal Engine's Python plugin settings.", "Help");
        if (clickedItem === "Help") {
            extensionWiki.openPageInBrowser(extensionWiki.Pages.enableDevmode);
        }

        /* As of right now enabling the setting automatically is not really possible, since editor preferences will be overriden when engine is closed
        isDevmodeEnabled(async bEnabled => {
            if (bEnabled) {
                // No stub file found but devmode is enabled, restarting the engine should generate a file
                addPythonAnalysisPath(stubFolderPath);
                vscode.window.showWarningMessage("Please restart both Unreal Engine & Visual Studio Code.");
            }
            else {
                // Ask user to enable dev mode so a stub file will be generated
                const selectedItem = await vscode.window.showWarningMessage(
                    "Devmode must be enabled in Unreal to generate python stub file",
                    "Enable Devmode"
                );
    
                if (selectedItem === "Enable Devmode") {
                    enableDevmode(bEnabled => {
                        if (bEnabled) {
                            addPythonAnalysisPath(stubFolderPath);
                            vscode.window.showWarningMessage("Devmode Enabled, please restart both Unreal Engine & Visual Studio Code.");
                        }
                        else {
                            // TODO: Add a button that links to a page explaining how to do so
                            vscode.window.showErrorMessage("Failed to enabled devmode, please enable it manually.");
                        }
                    }) ; 
                }
            }
        });
        */

    }
}


export function main() {
    getPythonPath(async stubFolderPath => {
        if (stubFolderPath) {
            setupPath(stubFolderPath);
        }
        else {
            // Ask user to browse to the UE project
            const value = await vscode.window.showErrorMessage(
                "Failed to automatically get the path to current Unreal Engine project",
                "Browse"
            );

            if (value === "Browse") {
                const selectedFiles = await vscode.window.showOpenDialog({
                    "filters": {"Unreal Projects": ["uproject"]},  // eslint-disable-line @typescript-eslint/naming-convention
                    "canSelectMany": false,
                    "title": "Browse to the Unreal Engine project .uproject file",
                    "openLabel": "Select project"
                });

                if (selectedFiles) {
                    const projectDirectory = path.dirname(selectedFiles[0].fsPath);
                    stubFolderPath = path.join(projectDirectory, "Intermediate", "PythonStub");
                    setupPath(stubFolderPath);
                }

            }
        }
    });
}