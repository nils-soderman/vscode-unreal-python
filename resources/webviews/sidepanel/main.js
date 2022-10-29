// ---------------------------------------------------------------------
//                          Utils
// ---------------------------------------------------------------------

class VSCode {
    api;

    messageListeners = {};

    constructor() {
        this.api = acquireVsCodeApi();
        window.addEventListener('message', this._onDataRecived.bind(this));
    }

    /**
     * Send a message to the VS Code extension
     * @param {string} command The name of the command 
     * @param {*} data Any data to pass along the command
     */
    postMessage(command, data) {
        this.api.postMessage({
            command: command,
            data: data
        });
    }

    /**
     * 
     * @param {MessageEvent<any>} event 
     */
    _onDataRecived(event) {
        const message = event.data; // The JSON data our extension sent

        if (message.command in this.messageListeners) {
            for (const callback of this.messageListeners[message.command]) {
                callback(message.data);
            }
        }
    }

    /**
     * Start listening for a spesific command
     * @param {string} command 
     * @param {Function} callback 
     */
    addCommandListener(command, callback) {
        if (!(command in this.messageListeners)) {
            this.messageListeners[command] = [];
        }
        this.messageListeners[command].push(callback);
    }
}

const vscode = new VSCode();


// ---------------------------------------------------------------------
//                          Events
// ---------------------------------------------------------------------
var gDocumentationPage = null;

function onDocumentationShown() {
    if (!gDocumentationPage) {
        gDocumentationPage = new DocumentationPage();
    }
}


// ---------------------------------------------------------------------
//                             Functions
// ---------------------------------------------------------------------

const classSubItemTypes = ["Method", "Class Method", "Property", "Constant"];


class DocumentationPage {

    content = {};
    contentFilteredCache = null;
    titles = [];

    bLiveFilter = false;

    /**
     * 
     * @param {Object} gTableOfContents The dictionary containing all of the content 
     */
    constructor() {

        // Request table of content
        vscode.postMessage("getTableOfContents");
        vscode.addCommandListener("tableOfContents", this.load.bind(this));
        vscode.addCommandListener("openDocPage", this.onPageDataRecived.bind(this));

        // Hook up events to the filter input
        const inputFilter = window.document.getElementById("input-filter");
        inputFilter.addEventListener('input', this.onFilterInput.bind(this));;
        inputFilter.addEventListener('change', this.onFilterChange.bind(this));

        // TODO: This body is now fetched twice
        const body = window.document.getElementById("content-body");
        body.addEventListener('click', this.onElementClicked.bind(this));

    }

    /**
     * 
     * @param {Object} gTableOfContents The dictionary containing all of the content 
     */
    load(tableOfContents) {
        this._buildPage(tableOfContents);
    }

    /**
     * 
     * @param {PointerEvent} event 
     */
    onElementClicked(event) {
        const objectName = event.target.innerText;
        vscode.postMessage("getDocPage", objectName);
    }

    onPageDataRecived(data) {
        console.log(data);
    }

    _buildPage(tableOfContents) {
        const builder = new DocumentationPageBuilder();

        const body = window.document.getElementById("content-body");

        for (const [key, value] of Object.entries(tableOfContents)) {
            const section = builder.createSection(key);

            if (Array.isArray(value)) {
                // Functions, since they are a flat list
                value.forEach(name => {
                    if (this.content[name] === undefined) {
                        this.content[name] = [];
                    }
                    this.content[name].push(builder.addMainItem(name));
                });
            }
            else {
                for (const [name, data] of Object.entries(value)) {
                    if (this.content[name] === undefined) {
                        this.content[name] = [];
                    }
                    this.content[name].push(builder.addMainItem(name));
                    classSubItemTypes.forEach(subType => {
                        data[subType].forEach(subName => {
                            if (this.content[subName] === undefined) {
                                this.content[subName] = [];
                            }
                            this.content[subName].push(builder.addSubItem(subName, subType));
                        });
                    });
                }
            }

            body.appendChild(section);
        }
    }



    /**
     * 
     * @param {InputEvent} event
     */
    onFilterInput(event) {
        if (this.bLiveFilter) {
            const filterText = event.target.value;
            this.filter(filterText);
        }
    }


    /**
     * 
     * @param {InputEvent} evenet
     */
    onFilterChange(event) {
        if (!this.bLiveFilter) {
            const filterText = event.target.value;
            this.filter(filterText);
        }
    }

    /**
     * 
     * @param {string} filterString The string to filter by
     */
    filter(filterString) {
        var startTime = performance.now();

        if (filterString === "") {
            for (const [key, value] of Object.entries(this.content)) {
                for (const element of value) {
                    element.hidden = element.className === "doc-item-sub";
                }
            }

            return;
        }

        /*
        if (this.contentFilteredCache === null) {
            this.contentFilteredCache = Object.assign({}, this.content);
            console.log(this.contentFilteredCache);
        }*/

        for (const [key, value] of Object.entries(this.content)) {

            const bHidden = !key.includes(filterString);
            /*if (bHidden) {
                delete this.contentFilteredCache[key];
            }*/

            for (const element of value) {
                // Only trigger a re-draw of the element if the visibility has changed
                if (element.hidden !== bHidden) {
                    element.hidden = bHidden;
                }
            }
        }

        // TODO: Only show the first say ~500 results, and load more if needed (either when scrollbar hits bottom, or a 'load 500 more...' btn).

        var execTime = (performance.now() - startTime);
        console.log(`Filtering took: ${execTime / 1000} seconds.`);
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