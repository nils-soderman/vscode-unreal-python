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
            await wiki.openPageInBrowser(page);
    });
});