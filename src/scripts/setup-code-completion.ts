/**
 * Script to add the directory where the 'unreal.py' stub file is generated to the `python.analysis.extraPaths` config.
 */

import * as vscode from 'vscode';

import * as path from 'path';

import * as remoteHandler from '../modules/remote-handler';
import * as extensionWiki from '../modules/extension-wiki';
import * as logger from '../modules/logger';
import * as utils from '../modules/utils';

import { ECommandOutputType } from "unreal-remote-execution";

export const STUB_FILE_NAME = "unreal.py";

const PYTHON_CONFIG = "python";
const EXTRA_PATHS_CONFIG = "analysis.extraPaths";


/**
 * Get the path to the directory where the 'unreal.py' stubfile is generated,
 * Based on the currently connected Unreal Engine project.
 */
export async function getUnrealStubDirectory(): Promise<vscode.Uri | null> {
    const getPythonPathScript = utils.FPythonScriptFiles.getUri(utils.FPythonScriptFiles.codeCompletionGetPath);
    const response = await remoteHandler.executeFile(getPythonPathScript, {});

    let directory: string | undefined = undefined;

    if (response) {
        for (const output of response.output) {
            logger.log(`[${output.type}] ${output.output}`);
            if (response.success && output.type === ECommandOutputType.INFO) {
                directory = output.output.trim();
            }
        }

        if (!response.success) {
            logger.logError("Failed to get the path to the Unreal Engine project", new Error(response.result));
            return null;
        }
    }

    if (directory)
        return vscode.Uri.file(directory);

    return null;
}


/**
 * Add a path to the `python.analysis.extraPaths` config. 
 * This function will also remove any current paths that ends w/ 'Intermediate/PythonStub' 
 * to prevent multiple Unreal stub directories beeing added
 * @param pathToAdd The path to add
 * @returns `true` if the path was added or already existed, `false` if the path could not be added
 */
function addPythonAnalysisPath(pathToAdd: string): "add" | "exists" | false {
    const fullConfigName = `${PYTHON_CONFIG}.${EXTRA_PATHS_CONFIG}`;

    const activeWorkspaceFolder = utils.getActiveWorkspaceFolder();
    const pythonConfig = vscode.workspace.getConfiguration(PYTHON_CONFIG, activeWorkspaceFolder?.uri);

    const bHasWorkspaceFileOpen = vscode.workspace.workspaceFile !== undefined;

    let extraPathsConfig = pythonConfig.inspect<string[]>(EXTRA_PATHS_CONFIG);
    if (!extraPathsConfig) {
        logger.log(`Failed to get the config '${fullConfigName}'`);
        return false;
    }

    // Use the global scope as default
    let settingsInfo = {
        niceName: "User",
        paths: extraPathsConfig.globalValue,
        scope: vscode.ConfigurationTarget.Global,
        openSettingsCommand: "workbench.action.openSettings"
    };

    // Search through the different scopes to find the first one that has a custom value
    const valuesToCheck = [
        {
            niceName: "Folder",
            paths: extraPathsConfig.workspaceFolderValue,
            scope: vscode.ConfigurationTarget.WorkspaceFolder,
            openSettingsCommand: bHasWorkspaceFileOpen ? "workbench.action.openFolderSettings" : "workbench.action.openWorkspaceSettings"
        },
        {
            niceName: "Workspace",
            paths: extraPathsConfig.workspaceValue,
            scope: vscode.ConfigurationTarget.Workspace,
            openSettingsCommand: "workbench.action.openWorkspaceSettings"
        }
    ];

    for (const value of valuesToCheck) {
        if (value.paths && value.paths !== extraPathsConfig.defaultValue) {
            settingsInfo = value;
            break;
        }
    }

    // Create a new list that will contain the old paths and the new one
    let newPathsValue = settingsInfo.paths ? [...settingsInfo.paths] : [];

    // Check if the path already exists
    if (newPathsValue.some(path => utils.isPathsSame(path, pathToAdd))) {
        logger.log(`Path "${pathToAdd}" already exists in '${fullConfigName}' in ${settingsInfo.niceName} settings.`);
        vscode.window.showInformationMessage(`Path "${pathToAdd}" already exists in '${fullConfigName}' in ${settingsInfo.niceName} settings.`);
        return "exists";
    }

    // Remove any paths that ends with 'Intermediate/PythonStub'
    newPathsValue = newPathsValue.filter(path => !path.endsWith("Intermediate/PythonStub"));

    // Add the new path and update the configuration
    newPathsValue.push(pathToAdd);
    pythonConfig.update(EXTRA_PATHS_CONFIG, newPathsValue, settingsInfo.scope);

    logger.log(`Added path "${pathToAdd}" to '${fullConfigName}' in ${settingsInfo.niceName} settings.`);

    vscode.window.showInformationMessage(`Updated '${fullConfigName}' in ${settingsInfo.niceName} settings.`, "Show Setting").then(
        (value) => {
            if (value === "Show Setting") {
                vscode.commands.executeCommand(settingsInfo.openSettingsCommand, `${fullConfigName}`);
            }
        }
    );

    return "add";
}


/**
 * Validate that a 'unreal.py' stub file exists in given directory, and if so add it to the `python.analysis.extraPaths` config.
 * If a valid stub file doesn't exist, user will be prompted to enable developer mode and the path will NOT be added to the python config.
 * @param stubDirectoryPath The directory where the 'unreal.py' stub file is located
 */
export async function validateStubAndAddToPath(stubDirectoryPath: vscode.Uri): Promise<false | "add" | "exists"> {
    // Check if a generated stub file exists
    const stubFilepath = vscode.Uri.joinPath(stubDirectoryPath, STUB_FILE_NAME);

    if (!await utils.uriExists(stubFilepath)) {
        logger.log(`Failed to find the generated stub file: "${stubFilepath}"`);
        // A generated stub file could not be found, ask the user to enable developer mode first
        vscode.window.showErrorMessage(
            "To setup code completion you first need to enable Developer Mode in Unreal Engine's Python plugin settings.",
            "Help"
        ).then((item) => {
            if (item === "Help")
                extensionWiki.openPageInBrowser(extensionWiki.FPages.enableDevmode);
        });

        return false;
    }

    return addPythonAnalysisPath(stubDirectoryPath.fsPath);
}


export async function main() {
    const autoStubDirectoryPath = await getUnrealStubDirectory();
    if (autoStubDirectoryPath) {
        validateStubAndAddToPath(autoStubDirectoryPath);
    }
    else {
        const selectedItem = await vscode.window.showErrorMessage(
            "Setup Code Completion: Failed to automatically get the path to current Unreal Engine project",
            "Browse Manually"
        );

        if (selectedItem === "Browse Manually") {
            const selectedFiles = await vscode.window.showOpenDialog({
                "filters": { "Unreal Project": ["uproject"] },  // eslint-disable-line @typescript-eslint/naming-convention
                "canSelectMany": false,
                "title": "Select the Unreal Engine project file (.uproject) to setup code completion for",
                "openLabel": "Select project"
            });

            if (selectedFiles) {
                // `selectedFiles[0]` should now be the .uproject file that the user whish to setup code completion for
                const projectDirectory = vscode.Uri.file(path.dirname(selectedFiles[0].fsPath));
                const manualStubDirectoryPath = vscode.Uri.joinPath(projectDirectory, "Intermediate", "PythonStub");
                validateStubAndAddToPath(manualStubDirectoryPath);
            }
        }
    }
}
