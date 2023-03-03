import "./docIndex.scss";
import { Component } from 'react';
import * as vscode from '../../Modules/vscode';
import DocHeader from './Header/docHeader';

import { VSCodeProgressRing } from '@vscode/webview-ui-toolkit/react';
import Container from "./Container/container";


interface RawTableOfContents {
    [type: string]: {
        [name: string]: {
            ClassMethod?: string[],
            Constant?: string[],
            Method?: string[],
            Property?: string[],
        }
    };
}

// We should convert toc into this format on mounted
interface TableOfContents {
    [Type: string]: {
        [Name: string]: string[]
    };
}


export default class DocIndex extends Component {
    state = { bLoading: true, tableOfContents: {} };


    async componentDidMount() {
        // Request the table of contents from the extension
        const tableOfContents: RawTableOfContents = await vscode.sendMessageAndWaitForResponse(vscode.EInOutCommands.getTableOfContents);

        this.setState({ tableOfContents: this.parseTableOfContents(tableOfContents) });

        // Hide the loading div
        this.setState({ bLoading: false });
    }

    parseTableOfContents(tableOfContents: RawTableOfContents) {
        let parsedTableOfContents: TableOfContents = {};

        Object.keys(tableOfContents).forEach((type) => {
            parsedTableOfContents[type] = {};

            Object.keys(tableOfContents[type]).forEach((name) => {
                parsedTableOfContents[type][name] = [];

                Object.keys(tableOfContents[type][name]).forEach((subType) => {
                    parsedTableOfContents[type][name].push(...tableOfContents[type][name][subType]);
                });
            });
        });

        return parsedTableOfContents;
    }

    renderProgressRing() {
        if (this.state.bLoading) {
            return (
                <div id="loading">
                    <VSCodeProgressRing />
                </div>
            );
        }
    }

    onSearchInput(searchText: string) {
        console.log(searchText);
    }


    render() {
        return (
            <div>
                <DocHeader handleSearchInput={this.onSearchInput} />

                {this.renderProgressRing()}

                <div id="content">
                    {
                        Object.keys(this.state.tableOfContents).map((key, index) => {
                            return <Container key={key} name={key} contents={this.state.tableOfContents[key]}/>;
                        })
                    }
                </div>

            </div>
        );
    }
}