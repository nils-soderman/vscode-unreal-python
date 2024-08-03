/**
 * This file contains mock classes and functions for testing vscode extensions
 */
import * as vscode from 'vscode';

import * as https from 'https';
import * as os from 'os';

import sinon from 'sinon';


export const TEST_UUID = crypto.randomUUID();


export class ConfigMock implements vscode.WorkspaceConfiguration {
    globalValue: Record<string, any>;
    workspaceValue: Record<string, any>;
    workspaceFolderValue: Record<string, any>;

    constructor(readonly defaultValue: Record<string, any>) {
        this.globalValue = { ...defaultValue };
        this.workspaceValue = { ...defaultValue };
        this.workspaceFolderValue = { ...defaultValue };
    }

    get(key: string, defaultValue?: any) {
        return this.globalValue[key] || defaultValue;
    }

    inspect(key: string) {
        return {
            key: key,
            globalValue: this.globalValue[key],
            workspaceValue: this.workspaceValue[key],
            workspaceFolderValue: this.workspaceFolderValue[key],
            defaultValue: this.defaultValue[key]
        };
    }

    update(key: string, value: any, configurationTarget?: boolean | vscode.ConfigurationTarget, overrideInLanguage?: boolean) {
        if (configurationTarget === vscode.ConfigurationTarget.Workspace)
            this.workspaceValue[key] = value;
        else if (configurationTarget === vscode.ConfigurationTarget.WorkspaceFolder)
            this.workspaceFolderValue[key] = value;
        else
            this.globalValue[key] = value;

        return Promise.resolve();
    }

    has(key: string) {
        return this.globalValue[key] !== undefined;
    }

    reset() {
        this.globalValue = { ...this.defaultValue };
        this.workspaceValue = { ...this.defaultValue };
        this.workspaceFolderValue = { ...this.defaultValue };
    }
}


export class MockOutputChannel implements vscode.OutputChannel {
    bVisible = false;
    output: string[] = [];
    disposed = false;
    name: string = "";

    logLevel: vscode.LogLevel = vscode.LogLevel.Info;

    appendLine(line: string) {
        this.output.push(line + "\n");
    }

    clear() {
        this.output = [];
    }

    show() {
        this.bVisible = true;
    }

    hide() {
        this.bVisible = false;
    }

    append(value: string): void {
        this.output.push(value);
    }

    replace(value: string): void {
        this.output = [value];
    }

    dispose(): void {
        this.output = [];
        this.bVisible = false;
        this.disposed = true;
    }
}

/**
 * Create a stub for vscode.window.showQuickPick that returns the first item in the list
 */
export function stubShowQuickPick() {
    const showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick');

    showQuickPickStub.callsFake(async (items: readonly vscode.QuickPickItem[] | Thenable<readonly vscode.QuickPickItem[]>, options: vscode.QuickPickOptions | undefined, token?: vscode.CancellationToken | undefined) => {
        return new Promise(async (resolve) => {
            resolve((await items)[0]);
        });
    });

    return showQuickPickStub;
}

export function stubGetConfiguration(config: Record<string, ConfigMock>) {
    const getConfigurationStub = sinon.stub(vscode.workspace, 'getConfiguration');

    getConfigurationStub.callsFake((section?: string, scope?: vscode.ConfigurationScope | null) => {
        if (!section) {
            throw new Error('Section is required');
        }

        return config[section] as vscode.WorkspaceConfiguration;
    });

    return getConfigurationStub;
}

export function mockOpenExternal() {
    const stubOpenExternal = sinon.stub(vscode.env, "openExternal");
    stubOpenExternal.callsFake((uri: vscode.Uri): Promise<boolean> => {
        return new Promise((resolve, reject) => {
            https.get(uri.toString(), (res) => {
                if (res.statusCode === 200) {
                    resolve(true);
                } else {
                    reject(`Url ${uri.toString()} return with status code ${res.statusCode}, expected 200`);
                }
            }).on('error', (e) => {
                reject(`Failed to make a GET request to ${uri.toString()}: ${e.message}`);
            });
        });
    });

    return stubOpenExternal;
}


export function getTempDir(name: string): vscode.Uri {
    const tmpDir = vscode.Uri.file(os.tmpdir());
    return vscode.Uri.joinPath(tmpDir, "mobu-utils-test-" + TEST_UUID, name);
}


export function getExtensionContext() {
    const globalStorageTempDir = getTempDir("globalStorage");

    return {
        globalStorageUri: globalStorageTempDir,
    } as vscode.ExtensionContext;
}
