import "./docIndex.scss";
import { Component } from 'react';
import * as vscode from '../../Modules/vscode';
import DocHeader from './Header/docHeader';

import { VSCodeProgressRing } from '@vscode/webview-ui-toolkit/react';

export default class DocIndex extends Component {
    state = { bLoading: true };

    async componentDidMount() {
        // Request the table of contents from the extension
        const tableOfContents = await vscode.sendMessageAndWaitForResponse(vscode.EInOutCommands.getTableOfContents);
        console.log(tableOfContents);

        // Hide the loading div
        this.setState({ bLoading: false });
    }


    render() {


        
        return (
            <div>
                <DocHeader />

                {this.state.bLoading &&
                    <div id="loading">
                        <VSCodeProgressRing />
                    </div>
                }
            </div>
        );
    }
}