import * as assert from 'assert';

import * as vscode from 'vscode';

import sinon from 'sinon';

import * as testUtils from '../test-utils';
import * as vscodeMock from '../vscode-mock';

import * as utils from '../../modules/utils';
import * as attach from '../../scripts/attach';
import * as remote from '../../modules/remote-handler';




const CONFIG_KEYS = {
    port: "attach.port",
    autoPort: "attach.autoPort",
    type: "attach.type"
};


suite('Attach', function () {
    testUtils.initializeExtension();
    this.timeout(30 * 1000);

    const extensionConfig = new vscodeMock.ConfigMock({
        [CONFIG_KEYS.port]: 4243,
        [CONFIG_KEYS.autoPort]: true,
        [CONFIG_KEYS.type]: "debugpy",
        ...testUtils.CONNECTION_CONFIG
    });

    let extensionContext: vscode.ExtensionContext;
    let tempDebugpyInstallDir: vscode.Uri;

    suiteTeardown(async () => {
        if (await testUtils.uriExists(tempDebugpyInstallDir))
            await vscode.workspace.fs.delete(tempDebugpyInstallDir, { recursive: true });
    });

    setup(() => {
        extensionContext = vscodeMock.getExtensionContext();
        tempDebugpyInstallDir = vscode.Uri.joinPath(extensionContext.globalStorageUri, "site-packages");

        vscodeMock.stubGetConfiguration({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "ue-python": extensionConfig
        });
    });

    teardown(async () => {
        sinon.restore();
        extensionConfig.reset();

        await vscode.debug.stopDebugging();
    });

    test('Install Debugpy', async function () {
        assert.ok(await attach.installDebugpy());
        assert.ok(await attach.isDebugpyInstalled());
    });

    test('Start Debugpy & Attach', async function () {
        const projectName = (await remote.getRemoteExecutionInstance())?.connectedNode?.data.project_name;
        assert.ok(projectName, "Failed to get project name");

        assert.ok(await attach.main(), "Failed to attach");

        assert.ok(utils.isDebuggingUnreal(projectName), "isDebuggingUnreal() returned false");

        // Re-attach should not start a new session
        assert.ok(await attach.main(), "Re-attach returned false");
    });

    test('Re-attach', async function () {
        const projectName = (await remote.getRemoteExecutionInstance())?.connectedNode?.data.project_name;
        assert.ok(projectName, "Failed to get project name");

        assert.ok(await attach.getCurrentDebugpyPort(), "Failed to get current Debugpy port");

        assert.ok(!utils.isDebuggingUnreal(projectName), "isDebuggingUnreal() returned true");
        assert.ok(await attach.main(), "Failed to attach");

        assert.ok(utils.isDebuggingUnreal(projectName), "isDebuggingUnreal() returned false");
    });

});
