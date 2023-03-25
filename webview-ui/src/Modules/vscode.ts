const vscode = acquireVsCodeApi();


export enum EInOutCommands {
    getTableOfContents = "getTableOfContents",
    getDocPage = "getDocPage",
    getDropDownAreaOpenStates = "getDropDownAreaOpenStates",
    getMaxListItems = "getMaxListItems"
}

export enum EOutCommands {
    storeDropDownAreaOpenState = "storeDropDownAreaOpenState",
    storeMaxListItems = "storeMaxListItems"
}

export enum EInCommands {
}



export function sendMessage(command: EInOutCommands | EOutCommands, data?: any) {
    vscode.postMessage({ command: command, data: data });
}

export function sendMessageAndWaitForResponse(command: EInOutCommands, data?: any): Promise<any> {
    return new Promise(resolve => {
        const callback = (data: any) => {
            listener.removeListener(command, callback);
            resolve(data);
        };

        listener.addListener(command, callback);
        sendMessage(command, data);
    });
}

class Listener {
    listeners: { [key: string]: ((data: any) => void)[] } = {};

    constructor() {
        window.addEventListener('message', event => {
            const message = event.data;
            if (this.listeners[message.command] !== undefined) {
                for (const listener of this.listeners[message.command]) {
                    listener(message.data);
                }
            }
        });
    }

    addListener(command: EInOutCommands | EInCommands, callback: (data: any) => void) {
        if (this.listeners[command] === undefined)
            this.listeners[command] = [];

        this.listeners[command].push(callback);
    }

    removeListener(command: EInOutCommands | EInCommands, callback: (data: any) => void) {
        if (this.listeners[command] === undefined)
            return;

        const index = this.listeners[command].indexOf(callback);
        if (index > -1)
            this.listeners[command].splice(index, 1);
    }
}

export const listener = new Listener();