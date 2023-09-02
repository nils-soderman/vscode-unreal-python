/**
 * Script to add the directory where the 'unreal.py' stub file is generated to the `python.analysis.extraPaths` config.
 */

import * as vscode from 'vscode';

import * as path from 'path';
import * as fs from 'fs';

import * as remoteHandler from '../modules/remote-handler';
import * as extensionWiki from '../modules/extension-wiki';
import * as utils from '../modules/utils';

import { ECommandOutputType } from "unreal-remote-execution";

const STUB_FILE_NAME = "unreal.py";

const PYTHON_CONFIG = "python";
const EXTRA_PATHS_CONFIG = "analysis.extraPaths";

const MS_PYTHON_EXTENSION_ID = "ms-python.python";

const STUB_FILE_RELATIVE_FOLDER = "Intermediate/PythonStub";


/**
 * Get the python extension's configuration 
 */
function getPythonConfig() {
    return vscode.workspace.getConfiguration(PYTHON_CONFIG);
}


/**
 * Get the path to the directory where the 'unreal.py' stubfile is generated.
 * The path will be for the currently connected Unreal project
 */
async function getUnrealStubDirectory() {
    const getPythonPathScript = utils.FPythonScriptFiles.getAbsPath(utils.FPythonScriptFiles.codeCompletionGetPath);
    const response = await remoteHandler.executeFile(getPythonPathScript, {});
    if (response) {
        for (const output of response.output) {
            if (output.type === ECommandOutputType.INFO) {
                return output.output.trim();
            }
        }
    }

    return null;
}


/**
 * Add a path to the `python.analysis.extraPaths` config. 
 * This function will also remove any current paths that ends w/ 'Intermediate/PythonStub' 
 * to prevent multiple Unreal stub directories beeing added
 * @param pathToAdd The path to add
 * @returns `true` if the path was added or already existed, `false` if the path could not be added
 */
function addPythonAnalysisPath(pathToAdd: string): boolean {
    // Make path use forward slashes, as it looks cleaner in the config file
    pathToAdd = utils.ensureForwardSlashes(pathToAdd);

    const pythonConfig = getPythonConfig();
    let extraPaths: Array<string> | undefined = pythonConfig.get(EXTRA_PATHS_CONFIG);
    if (extraPaths === undefined)
        return false;

    const pathsToRemove: string[] = [];

    for (const extraPath of extraPaths) {
        // Check if the path already exist
        if (utils.isPathsSame(extraPath, pathToAdd)) {
            return true;
        }

        // Check if any other Unreal python paths exists, and if so remove them (if e.g. switching between projects)
        const comparePath = utils.ensureForwardSlashes(path.resolve(extraPath)).toLowerCase();
        if (comparePath.endsWith(STUB_FILE_RELATIVE_FOLDER.toLowerCase())) {
            pathsToRemove.push(extraPath);
        }
    }

    // Remove any additional Unreal stub directories found
    extraPaths = extraPaths.filter(e => !pathsToRemove.includes(e));

    // Add the path to extraPaths & update the config
    extraPaths.push(pathToAdd);
    pythonConfig.update(EXTRA_PATHS_CONFIG, extraPaths, true);

    return true;
}


/**
 * Validate that a 'unreal.py' stub file exists in given directory, and if so add it to the `python.analysis.extraPaths` config.
 * If a valid stub file doesn't exist, user will be prompted to enable developer mode and the path will NOT be added to the python config.
 * @param stubDirectoryPath The directory where the 'unreal.py' stub file is located
 */
async function validateStubAndAddToPath(stubDirectoryPath: string) {
    // Check if a generated stub file exists
    const stubFilepath = path.join(stubDirectoryPath, STUB_FILE_NAME);

    if (fs.existsSync(stubFilepath)) {
        const configFullId = `${PYTHON_CONFIG}.${EXTRA_PATHS_CONFIG}`;

        if (addPythonAnalysisPath(stubDirectoryPath)) {
            const clickedItem = await vscode.window.showInformationMessage(`Added "${stubDirectoryPath}" to the '${configFullId}' config`, "Show Setting");
            if (clickedItem === "Show Setting")
                vscode.commands.executeCommand("workbench.action.openSettings", configFullId);
        }
        else {
            const clickedItem = await vscode.window.showErrorMessage(`Config '${configFullId}' not found, make sure ${MS_PYTHON_EXTENSION_ID} extension is installed and enabled`, "Show Extension");
            if (clickedItem === "Show Extension")
                vscode.commands.executeCommand("workbench.extensions.search", MS_PYTHON_EXTENSION_ID);
        }
    }
    else {
        // A generated stub file could not be found, ask the user to enable developer mode first
        const clickedItem = await vscode.window.showErrorMessage("To setup code completion you first need to enable Developer Mode in Unreal Engine's Python plugin settings.", "Help");
        if (clickedItem === "Help") {
            extensionWiki.openPageInBrowser(extensionWiki.FPages.enableDevmode);
        }
    }
}


export async function main() {
    const stubDirectoryPath = await getUnrealStubDirectory();
    if (stubDirectoryPath) {
        validateStubAndAddToPath(stubDirectoryPath);
    }
    else {
        // Failed to get the path, ask user to manually browse to the UE project
        const selectedItem = await vscode.window.showErrorMessage(
            "Failed to automatically get the path to current Unreal Engine project",
            "Browse"
        );

        if (selectedItem === "Browse") {
            // Show a file browser dialog, asking the user to select a '.uproject' file
            const selectedFiles = await vscode.window.showOpenDialog({
                "filters": { "Unreal Projects": ["uproject"] },  // eslint-disable-line @typescript-eslint/naming-convention
                "canSelectMany": false,
                "title": "Browse to the Unreal Engine project .uproject file",
                "openLabel": "Select project"
            });

            if (selectedFiles) {
                // `selectedFiles[0]` should now be the .uproject file that the user whish to setup code completion for
                const projectDirectory = path.dirname(selectedFiles[0].fsPath);
                const projectStubDirectoryPath = path.join(projectDirectory, "Intermediate", "PythonStub");
                validateStubAndAddToPath(projectStubDirectoryPath);
            }
        }
    }
}