import * as assert from 'assert';

import * as vscode from 'vscode';

import sinon from 'sinon';

import * as testUtils from '../test-utils';
import * as vscodeMock from '../vscode-mock';

import * as utils from '../../modules/utils';
import * as execute from '../../scripts/execute';
import * as remoteHandler from '../../modules/remote-handler';


const CONFIG_KEYS = {
    port: "attach.port",
    autoPort: "attach.autoPort",
    name: "execute.name",
    addWorkspaceToPath: "environment.addWorkspaceToPath",
    clearOutput: "execute.clearOutput",
    showOutput: "execute.showOutput"
};

suite('Execute', function () {
    testUtils.initializeExtension();
    this.timeout(30 * 1000);

    const execName = "Hello World!";

    const extensionConfig = new vscodeMock.ConfigMock({
        [CONFIG_KEYS.autoPort]: true,
        [CONFIG_KEYS.name]: execName,
        [CONFIG_KEYS.addWorkspaceToPath]: true,
        [CONFIG_KEYS.clearOutput]: true,
        ...testUtils.CONNECTION_CONFIG
    });

    let outputChannel: vscodeMock.MockOutputChannel;

    const fileTest = testUtils.getPythonTestFilepath("test.py");


    setup(() => {
        outputChannel = new vscodeMock.MockOutputChannel();
        sinon.stub(utils, "getOutputChannel").returns(outputChannel);

        vscodeMock.stubGetConfiguration({
            "ue-python": extensionConfig // eslint-disable-line @typescript-eslint/naming-convention
        });
    });

    teardown(async () => {
        sinon.restore();
        extensionConfig.reset();

        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    });

    test('Sys Paths', async function () {
        const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        assert.ok(workspacePath, "No workspace folder open");

        await remoteHandler.closeRemoteConnection();

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const instance = await remoteHandler.getConnectedRemoteExecutionInstance();
        const response = await instance?.runCommand("import sys;print(','.join(sys.path))");

        assert.ok(response?.success);

        const paths = response?.output[0].output.trim().split(",");
        assert.ok(paths.includes(workspacePath), `Workspace path not found in sys.path: ${paths}`);
    });

    test('Execute Test.py', async function () {
        await vscode.window.showTextDocument(fileTest);

        await execute.main();

        assert.ok(outputChannel.output.length === 2, `Unexpected number of output lines: ${outputChannel.output.length}, output:\n${outputChannel.output.join("\n")}`);
        assert.strictEqual(outputChannel.output[0], execName + "\n");
    });

    test('Clear Output', async function () {
        await vscode.window.showTextDocument(fileTest);

        await extensionConfig.update(CONFIG_KEYS.clearOutput, false);
        for (let i = 1; i <= 3; i++) {
            await execute.main();
            // *2 because of the '>>>' added to each output
            assert.equal(outputChannel.output.length, i * 2, `Unexpected number of output lines: ${outputChannel.output.length}, output:\n${outputChannel.output.join("\n")}`);
        }

        await extensionConfig.update(CONFIG_KEYS.clearOutput, true);
        for (let i = 1; i <= 3; i++) {
            await execute.main();
            assert.equal(outputChannel.output.length, 2, `Unexpected number of output lines: ${outputChannel.output.length}, output:\n${outputChannel.output.join("\n")}`);
        }
    });

    test('Show Output', async function () {
        await vscode.window.showTextDocument(fileTest);
        outputChannel.bVisible = false;

        extensionConfig.update(CONFIG_KEYS.showOutput, false);
        await execute.main();
        assert.ok(!outputChannel.bVisible);

        extensionConfig.update(CONFIG_KEYS.showOutput, true);
        await execute.main();
        assert.ok(outputChannel.bVisible);
    });

    test('Execute Selection', async function () {
        // Create a new empty document
        const doc = await vscode.workspace.openTextDocument({ language: "python", content: "    print('0')\n  print('1')\n print('2')" });
        const editor = await vscode.window.showTextDocument(doc);

        editor.selection = new vscode.Selection(new vscode.Position(1, 0), new vscode.Position(2, 0));
        await execute.main();

        assert.ok(outputChannel.output.length === 2);
        assert.strictEqual(outputChannel.output[0], '1\n');

        editor.selection = new vscode.Selection(new vscode.Position(1, 0), new vscode.Position(3, 0));
        await execute.main();

        // @ts-ignore
        assert.ok(outputChannel.output.length === 3);
        assert.strictEqual(outputChannel.output[0], '1\n');
        assert.strictEqual(outputChannel.output[1], '2\n');
    });

    test('UTF-8 Characters', async function () {
        const utf8String = "你好世界-öäå";
        const doc = await vscode.workspace.openTextDocument({ language: "python", content: `print("${utf8String}")` });
        await vscode.window.showTextDocument(doc);

        await execute.main();

        assert.strictEqual(outputChannel.output[0], utf8String + '\n');
    });

    test('Large Unsaved Output', async function () {
        const utf8String = "abc-你好世界-öäå";

        const doc = await vscode.workspace.openTextDocument({ language: "python", content: `for i in range(250):\n    print('${utf8String}')` });
        await vscode.window.showTextDocument(doc);

        await execute.main();

        assert.strictEqual(outputChannel.output.length, 251);
        for (let i = 0; i < 250; i++) {
            assert.strictEqual(outputChannel.output[i], utf8String + '\n');
        }
    });

    test('No Editor', async function () {
        assert.equal(await execute.main(), false);
    });

});
