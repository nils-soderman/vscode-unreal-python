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
        vscode.addCommandListener("openDocPage", this.onOpenPage.bind(this));

        // Hook up events to the filter input
        const inputFilter = window.document.getElementById("input-filter");
        inputFilter.addEventListener('input', this.onFilterInput.bind(this));;
        inputFilter.addEventListener('change', this.onFilterChange.bind(this));

        // Fetch some elements that this class will need to refer to
        this.elementTableOfContentsBody = window.document.getElementById("doc-table-of-contents-body");
        this.elementTableOfContents = window.document.getElementById("doc-table-of-contents");
        this.elementDocPage = window.document.getElementById("doc-page");
        this.elementTableOfContentsBody.addEventListener('click', this.onElementClicked.bind(this));
        
        const elementDocPageBack = window.document.getElementById("doc-page-back");
        elementDocPageBack.addEventListener('click', this.onOpenTableOfContents.bind(this));
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

    onOpenTableOfContents() {
        this.elementTableOfContents.hidden = false;
        this.elementDocPage.hidden = true;
    }

    onOpenPage(data) {
        console.log(data);

        const elementDocPageContent = window.document.getElementById("doc-page-content");

        this.elementTableOfContents.hidden = true;
        this.elementDocPage.hidden = false;


        const elementTitle = window.document.getElementById("doc-page-title");
        elementTitle.innerText = data.name;

        // Class Bases
        // TODO: Make em clickable
        const elementBases = window.document.getElementById("doc-page-base");
        elementBases.innerHTML = `Bases: ${data.bases}`;

        const elementDesc = window.document.getElementById("doc-page-desc");
        
        let docString = data.doc;
        docString = docString.substring(0, docString.toLowerCase().indexOf("**editor properties:**"));
        elementDesc.innerText = docString;
        

        const builder = new DocumentationPageBuilder();


        [
            [data.members.unique.property, "Properties", false],
            [data.members.unique.method, "Methods", true],
            [data.members.inherited.property, "Inherited Properties", false],
            [data.members.inherited.method, "Inherited Methods", true],
        ].forEach((member) => {
            if (member[0].length > 0) {
                const section = builder.createSection(member[1]);
                member[0].forEach(memberData => builder.addDocMember(memberData, member[2]));
                elementDocPageContent.appendChild(section);
            }
        });

        


    }

    _buildPage(tableOfContents) {
        const builder = new DocumentationPageBuilder();

        for (const [key, value] of Object.entries(tableOfContents)) {
            const section = builder.createSection(key);

            if (Array.isArray(value)) {
                // Functions, since they are a flat list
                value.forEach(name => {
                    if (this.content[name.toLowerCase()] === undefined) {
                        this.content[name.toLowerCase()] = [];
                    }
                    this.content[name.toLowerCase()].push(builder.addMainItem(name));
                });
            }
            else {
                for (const [name, data] of Object.entries(value)) {
                    if (this.content[name.toLowerCase()] === undefined) {
                        this.content[name.toLowerCase()] = [];
                    }
                    this.content[name.toLowerCase()].push(builder.addMainItem(name));
                    classSubItemTypes.forEach(subType => {
                        data[subType].forEach(subName => {
                            if (this.content[subName.toLowerCase()] === undefined) {
                                this.content[subName.toLowerCase()] = [];
                            }
                            this.content[subName.toLowerCase()].push(builder.addSubItem(subName, subType));
                        });
                    });
                }
            }

            this.elementTableOfContentsBody.appendChild(section);
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

        filterString = filterString.toLowerCase();

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

    addDocMember(data, bMethod) {
        const item = document.createElement('div');

        let name, docstring, _;
        if (bMethod) {
            if (data.doc.includes("--")) {
                [name, docstring, _] = data.doc.split(/--(.*)/s);
            } else {
                [name, docstring, _] = data.doc.split(/\n(.*)/s);
            }
        }
        else {
            name = data.name;
            docstring = data.doc;
        }
        
        const itemTitle = document.createElement('h3');
        if (name.toLowerCase().startsWith("x.")) {
            name = name.substring(2);
        }
        itemTitle.innerText = name;

        const itemDocString = document.createElement('p');
        itemDocString.innerText = docstring;

        item.appendChild(itemTitle);
        item.appendChild(itemDocString);
        
        this.currentItemContainer.appendChild(item);

        return item;
    }

}




// ---------------------------------------------------------------------
//                               Main
// ---------------------------------------------------------------------


function main() {
    onDocumentationShown();
}

main();