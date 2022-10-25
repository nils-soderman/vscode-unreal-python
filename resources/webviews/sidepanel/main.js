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

const classSubItemTypes = ["Method", "Class Method", "Property", "Constant"];


class DocumentationPage {

    rawTableOfContents = null;
    content = [];
    titles = [];

    /**
     * 
     * @param {Object} gTableOfContents The dictionary containing all of the content 
     */
    constructor(tableOfContents) {
        this.rawTableOfContents = tableOfContents;
    
        this._buildPage();
    }
    
    _buildPage() {
        const builder = new DocumentationPageBuilder();
        
        const body = window.document.getElementById("content-body");
        
        for (const [key, value] of Object.entries(this.rawTableOfContents)) {
            const section = builder.createSection(key);
            
            if (Array.isArray(value)) {
                // Functions, since they are a flat list
                value.forEach(name => {
                    builder.addMainItem(name);
                });
            }
            else {
                for (const [name, data] of Object.entries(value)) {
                    builder.addMainItem(name);
                    classSubItemTypes.forEach(subType => {
                        data[subType].forEach(subName => {
                            builder.addSubItem(subName, subType);
                        });
                    });
                }
            }

            body.appendChild(section);
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
    currentItemContainer;
    currentItemName = "";

    /**
     * 
     * @param {string} text 
     * @returns {HTMLHeadingElement}
     */
    createTitle(text) {
        const header = document.createElement('h2');
        header.append(text);
        return header;
    }

    /**
     * 
     * @param {string} title 
     * @returns {HTMLDivElement}
     */
    createSection(title) {
        const titleElement = this.createTitle(title);

        const itemContainer = document.createElement('div');
        itemContainer.id = `${title}-items`;

        this.currentItemContainer = itemContainer;

        const baseElelemt = document.createElement('div');
        baseElelemt.id = title;

        baseElelemt.appendChild(titleElement);
        baseElelemt.appendChild(itemContainer);

        return baseElelemt;
    }

    addMainItem(name) {
        if (!this.currentItemContainer) {
            throw new Error("currentItemContainer has not been set!");
        }

        const item = document.createElement('div');
        item.append(name);
        
        item.className = "doc-item";
        
        this.currentItemName = name;
        this.currentItemContainer.appendChild(item);
        
        return item;
    }

    addSubItem(name, type) {
        if (!this.currentItemContainer) {
            throw new Error("currentItemContainer has not been set!");
        }

        const subItem = document.createElement('div');
        subItem.append(`${this.currentItemName}.${name} [${type}]`);

        subItem.className = "doc-item-sub";

        subItem.hidden = true;

        this.currentItemContainer.appendChild(subItem);

        return subItem;
    }


}




// ---------------------------------------------------------------------
//                               Main
// ---------------------------------------------------------------------


function main() {
    onDocumentationShown();
}

main();