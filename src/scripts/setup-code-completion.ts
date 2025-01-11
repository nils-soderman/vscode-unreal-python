/**
 * Adds the directory where the 'unreal.py' stub file is generated to the `python.analysis.extraPaths` config.
 */

import * as vscode from 'vscode';

import * as path from 'path';

import * as remoteHandler from '../modules/remote-handler';
import * as extensionWiki from '../modules/extension-wiki';
import * as logger from '../modules/logger';
import * as utils from '../modules/utils';

export const STUB_FILE_NAME = "unreal.py";

const CONFIG_PYTHON = "python";
const CONFIG_KEY_EXTRA_PATHS = "analysis.extraPaths";

interface ISettingsInfo {
    niceName: string;
    paths: string[] | undefined;
    scope: vscode.ConfigurationTarget;
    openSettingsCommand: string;
}

interface IInspectionSettings {
    globalValue?: string[];
    workspaceValue?: string[];
    workspaceFolderValue?: string[];
    defaultValue?: string[];
}


/**
 * Get the path to the directory where the 'unreal.py' stubfile is generated,
 * Based on the currently connected Unreal Engine project.
 */
export async function getUnrealStubDirectory(): Promise<vscode.Uri | null> {
    const getPythonPathScript = utils.FPythonScriptFiles.getUri(utils.FPythonScriptFiles.codeCompletionGetPath);
    const response = await remoteHandler.evaluateFunction(getPythonPathScript, "get_python_stub_dir");

    if (response && remoteHandler.logResponseAndReportErrors(response, "Failed to get the path to the Unreal Engine stub")) {
        // The result string contains quote characters, strip those
        const stubDirectoryPath = response.result.slice(1, -1);
        return vscode.Uri.file(stubDirectoryPath);
    }

    return null;
}


/**
 * Check if the 'ms-python.vscode-pylance' extension is installed, and if not prompt the user to install it.
 * @returns 
 */
function validatePylanceExtension(): boolean {
    const PYLANCE_EXTENSION_ID = "ms-python.vscode-pylance";
    const PYLANCE_EXTENSION_URL = "https://marketplace.visualstudio.com/items?itemName=ms-python.vscode-pylance";
    const SHOW_PYLANCE = "Show Pylance";

    // Pylance is the extension that provides the 'python.analysis.extraPaths' setting
    const pylanceExtension = vscode.extensions.getExtension(PYLANCE_EXTENSION_ID);
    if (!pylanceExtension) {
        vscode.window.showErrorMessage(
            `[${PYLANCE_EXTENSION_ID}](${PYLANCE_EXTENSION_URL}) not installed. Could not update the '${CONFIG_PYTHON}.${CONFIG_KEY_EXTRA_PATHS}' setting.`,
            SHOW_PYLANCE
        ).then((value) => {
            if (value === SHOW_PYLANCE)
                vscode.commands.executeCommand("extension.open", PYLANCE_EXTENSION_ID);
        });

        return false;
    }

    return true;
}

/** 
 * 
 */
function getSettingsInfo(extraPathsConfig: IInspectionSettings): ISettingsInfo {
    const bHasWorkspaceFileOpen = vscode.workspace.workspaceFile !== undefined;

    const valuesToCheck: ISettingsInfo[] = [
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
    
    // Search through the different scopes to find the first one that has a custom value
    for (const value of valuesToCheck) {
        if (value.paths && value.paths !== extraPathsConfig.defaultValue) {
            return value;
        }
    }

    // Default to global/User settings
    return {
        niceName: "User",
        paths: extraPathsConfig.globalValue,
        scope: vscode.ConfigurationTarget.Global,
        openSettingsCommand: "workbench.action.openSettings"
    };
}


/**
 * Add a path to the `python.analysis.extraPaths` config. 
 * This function will also remove any current paths that ends w/ 'Intermediate/PythonStub' 
 * to prevent multiple Unreal stub directories beeing added
 * @param pathToAdd The path to add
 * @returns `true` if the path was added or already existed, `false` if the path could not be added
*/
function addPythonAnalysisPath(pathToAdd: string): "add" | "exists" | false {
    if (!validatePylanceExtension())
        return false;

    const extraPathsConfigName = `${CONFIG_PYTHON}.${CONFIG_KEY_EXTRA_PATHS}`;

    const pythonConfig = vscode.workspace.getConfiguration(CONFIG_PYTHON, utils.getActiveWorkspaceFolder()?.uri);

    let extraPathsConfig = pythonConfig.inspect<string[]>(CONFIG_KEY_EXTRA_PATHS);
    if (!extraPathsConfig) {
        logger.log(`Failed to get the config '${extraPathsConfigName}'`);
        return false;
    }

    const settingsInfo = getSettingsInfo(extraPathsConfig);

    // Create a new list that will contain the old paths and the new one
    let newPathsValue = settingsInfo.paths ? [...settingsInfo.paths] : [];

    // Check if the path already exists
    if (newPathsValue.some(path => utils.isPathsSame(path, pathToAdd))) {
        const message = `Path "${pathToAdd}" already exists in '${extraPathsConfigName}' in ${settingsInfo.niceName} settings.`;
        logger.log(message);
        vscode.window.showInformationMessage(message);
        return "exists";
    }

    // Make sure we only have one Unreal stub directory in the extra paths
    newPathsValue = newPathsValue.filter(path => !path.endsWith("Intermediate/PythonStub"));
    newPathsValue.push(pathToAdd);

    try {
        pythonConfig.update(CONFIG_KEY_EXTRA_PATHS, newPathsValue, settingsInfo.scope);
    }
    catch (error) {
        logger.logError(`Failed to update '${extraPathsConfigName}' in ${settingsInfo.niceName} settings.`, error as Error);
        return false;
    }

    logger.log(`Added path "${pathToAdd}" to '${extraPathsConfigName}' in ${settingsInfo.niceName} settings.`);

    vscode.window.showInformationMessage(`Updated '${extraPathsConfigName}' in ${settingsInfo.niceName} settings.`, "Show Setting").then(
        (value) => {
            if (value === "Show Setting") {
                vscode.commands.executeCommand(settingsInfo.openSettingsCommand, extraPathsConfigName);
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
            "To setup code completion you first need to enable Developer Mode in Unreal Engine's Python plugin settings, then restart the Unreal",
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
