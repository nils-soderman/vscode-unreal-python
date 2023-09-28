import * as vscode from 'vscode';

import * as remoteHandler from '../modules/remote-handler';

import { RemoteExecutionNode } from "unreal-remote-execution";


interface UnrealInstanceQuickPickItem extends vscode.QuickPickItem {
    node: RemoteExecutionNode;
}


export async function main() {
    const remoteExecution = await remoteHandler.getRemoteExecutionInstance();
    if (!remoteExecution)
        return;

    const quickPick = vscode.window.createQuickPick();

    // quickPick.title = "Select an Unreal Engine Instance";
    quickPick.placeholder = "Searching for Unreal Engine instances...";
    quickPick.busy = true;

    quickPick.onDidAccept(async () => {
        quickPick.hide();
        
        if (quickPick.selectedItems.length > 0) {
            const item = quickPick.selectedItems[0] as UnrealInstanceQuickPickItem;

            if (remoteExecution.hasCommandConnection()) {
                // Check if we're already connected to this node
                if (remoteExecution.connectedNode === item.node)
                    return;

                remoteExecution.closeCommandConnection();
            }

            await remoteExecution.openCommandConnection(item.node);

            remoteHandler.updateStatusBar(item.node);
        }

        quickPick.dispose();
    });

    quickPick.onDidHide(() => {
        remoteExecution.stopSearchingForNodes();
        quickPick.dispose();
    });

    let quickPickItems: UnrealInstanceQuickPickItem[] = [];
    remoteExecution.events.addEventListener("nodeFound", (node) => {
        const item = {
            "label": node.data.project_name,
            "description": node.data.project_root,
            "node": node,
        } as UnrealInstanceQuickPickItem;

        quickPickItems.push(item);

        quickPick.items = quickPickItems;
    });

    remoteExecution.events.addEventListener("nodeTimedOut", (node) => {
        quickPickItems = quickPickItems.filter((item) => {
            return item.node.nodeId !== node.nodeId;
        });

        quickPick.items = quickPickItems;
    });

    remoteExecution.startSearchingForNodes(1000);

    quickPick.show();
}