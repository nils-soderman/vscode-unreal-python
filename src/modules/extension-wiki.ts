import * as open from 'open';

export const WIKI_URL = "https://github.com/nils-soderman/vscode-unreal-python/wiki/";

export class Pages {
    static readonly failedToConnect = "Failed-to-connect-to-Unreal-Engine-%5BTroubleshooting%5D";
    static readonly enableDevmode = "How-to-enable-Developer-Mode-for-Python-in-Unreal-Engine";
}

export function getPageUrl(page: string) {
    return WIKI_URL + page;
}

export function openPageInBrowser(page: string) {
    const url = getPageUrl(page);
    open(url);
}