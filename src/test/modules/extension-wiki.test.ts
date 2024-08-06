import * as assert from 'assert';

import sinon from 'sinon';

import * as vscodeMock from '../vscode-mock';

import * as wiki from '../../modules/extension-wiki';


suite('Extension Wiki', () => {
    setup(() => {
        vscodeMock.mockOpenExternal();
    });

    teardown(() => {
        sinon.restore();
    });

    test('Wiki Urls', async function () {
        for (const page of Object.values(wiki.FPages))
            assert.ok(await wiki.openPageInBrowser(page), `Failed to open page ${page}`);
    });
});