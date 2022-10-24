gTableOfContents = null;

// ---------------------------------------------------------------------
//                          Utils
// ---------------------------------------------------------------------

const vscode = acquireVsCodeApi();


/**
 * Send a message to the VS Code extension
 * @param {string} command The name of the command 
 * @param {*} data Any data to pass along the command
 */
function vscodeSendMessage(command, data) {
    vscode.postMessage({
        command: command,
        data: data
    });
}


// ---------------------------------------------------------------------
//                          Message Listener
// ---------------------------------------------------------------------

window.addEventListener('message', event => {
    const message = event.data; // The JSON data our extension sent

    switch (message.command) {
        case 'tableOfContents':
            onRecivedTableOfContents(message.data);
            break;
    }
});




// ---------------------------------------------------------------------
//                          Events
// ---------------------------------------------------------------------

function onRecivedTableOfContents(content) {
    docPage = new DocumentationPage(content);
}


function onDocumentationShown() {
    // If we do not already have the table of contents, ask VSCode for it
    if (!gTableOfContents) {
        vscodeSendMessage("getTableOfContents");
    }
}


// ---------------------------------------------------------------------
//                             Functions
// ---------------------------------------------------------------------

class DocumentationPage {

    rawTableOfContents = null;
    content = [];
    titles = [];

    body;

    /**
     * 
     * @param {Object} gTableOfContents The dictionary containing all of the content 
     */
    constructor(tableOfContents) {
        this.rawTableOfContents = tableOfContents;

        this.body = window.document.getElementById("content-body");

        this._buildPage();
    }

    _buildPage() {
        const builder = new DocumentationPageBuilder();

        for (const [key, value] of Object.entries(this.rawTableOfContents)) {
            const title = builder.createTitle(key);
            this.body.appendChild(title);
            
            if (Array.isArray(value)) {
                // Functions, since they are a flat list
            }
            else {

            }
        }
    }

    /**
     * 
     * @param {string} searchString The search string to filter by
     */
    onFilter(searchString) {

    }
}

class DocumentationPageBuilder {
    createTitle(text) {
        const header = document.createElement('h2');
        header.append(text);
        return header;
    }
}




// ---------------------------------------------------------------------
//                               Main
// ---------------------------------------------------------------------


function main() {
    onDocumentationShown();
}

main();