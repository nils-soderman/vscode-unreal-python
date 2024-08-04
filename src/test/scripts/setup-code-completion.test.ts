import * as vscode from 'vscode';
import * as assert from 'assert';
import sinon from 'sinon';

import * as vscodeMock from '../vscode-mock';
import * as utils from '../test-utils';

import * as codeCompletion from '../../scripts/setup-code-completion';

const PYTHON_CONFIG_KEY = 'analysis.extraPaths';


suite('Setup Code Completion', () => {
    utils.initializeExtension();

    const tmpDir = vscodeMock.getTempDir("stub");

    const pythonConfig = new vscodeMock.ConfigMock({
        [PYTHON_CONFIG_KEY]: [],
    });

    const extensionConfig = new vscodeMock.ConfigMock(utils.CONNECTION_CONFIG);

    setup(() => {
        vscodeMock.stubGetConfiguration({
            "python": pythonConfig,
            "ue-python": extensionConfig  // eslint-disable-line @typescript-eslint/naming-convention
        });
    });

    teardown(async () => {
        sinon.restore();
        pythonConfig.reset();

        if (await utils.uriExists(tmpDir)) {
            await vscode.workspace.fs.delete(tmpDir, { recursive: true });
        }
    });

    test('Get Directory', async function () {
        assert.ok(await codeCompletion.getUnrealStubDirectory());
    });

    const testAddPythonAnalysisPath = async (dir: vscode.Uri) => {
        assert.strictEqual(await codeCompletion.validateStubAndAddToPath(dir), false);

        // Create the unreal.py file
        const stubFilepath = vscode.Uri.joinPath(dir, codeCompletion.STUB_FILE_NAME);
        await vscode.workspace.fs.writeFile(stubFilepath, new Uint8Array());

        assert.strictEqual(await codeCompletion.validateStubAndAddToPath(dir), "add");
        assert.strictEqual(await codeCompletion.validateStubAndAddToPath(dir), "exists");
    };

    test('Add Path - Global', async function () {
        await testAddPythonAnalysisPath(tmpDir);

        assert.strictEqual(pythonConfig.globalValue[PYTHON_CONFIG_KEY].length, 1);
    });

    test('Add Path - Workspace', async function () {
        pythonConfig.workspaceValue[PYTHON_CONFIG_KEY] = ['helloWorld'];

        await testAddPythonAnalysisPath(tmpDir);

        assert.strictEqual(pythonConfig.workspaceValue[PYTHON_CONFIG_KEY].length, 2);
    });

    test('Add Path - Workspace Folder', async function () {
        pythonConfig.workspaceFolderValue[PYTHON_CONFIG_KEY] = ['helloWorld'];

        await testAddPythonAnalysisPath(tmpDir);

        assert.strictEqual(pythonConfig.workspaceFolderValue[PYTHON_CONFIG_KEY].length, 2);
    });
});