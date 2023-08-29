import open = require('open');

export const WIKI_URL = "https://github.com/nils-soderman/vscode-unreal-python/wiki/";


/**
 * Struct of pages available on the wiki.  
 * All values are static
 */
export class FPages {
    static readonly failedToConnect = "Failed-to-connect-to-Unreal-Engine-%5BTroubleshooting%5D";
    static readonly enableDevmode = "How-to-enable-Developer-Mode-for-Python-in-Unreal-Engine";
}


/**
 * @param page The page to get the full URL of, should be a value of `FPages`
 * @returns The full page url
 */
export function getPageUrl(page: string) {
    return WIKI_URL + page;
}

/** 
 * Open a wiki page in the user's default webbrowser
 * @param page The page to open, should be a value of `FPages`
 */
export function openPageInBrowser(page: string) {
    const url = getPageUrl(page);
    open(url);
}