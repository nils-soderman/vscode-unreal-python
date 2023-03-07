import "./docIndex.scss";
import { Component, Fragment } from 'react';
import * as vscode from '../../Modules/vscode';
import DocHeader from './Header/docHeader';

import { VSCodeProgressRing } from '@vscode/webview-ui-toolkit/react';
import DropDownArea from "../../Components/dropDownArea";


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

interface DocIndexProps {
    onItemClicked: (name: string) => void;
}


export default class DocIndex extends Component<DocIndexProps> {
    state = { bLoading: true, tableOfContents: {}, filter: "" };


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
        this.setState({ filter: searchText });
    }


    renderContent() {
        return (
            <Fragment>
                {
                    Object.keys(this.state.tableOfContents).map((key, index) => {
                        return (
                            <DropDownArea key={index} title={key} badgeCount={Object.keys(this.state.tableOfContents[key]).length}>
                                <div className="doc-index-dd-content">
                                    {

                                        Object.entries(this.state.tableOfContents[key]).map(([name, contents], index) => {
                                            return (
                                                <span key={index} onClick={() => this.props.onItemClicked(name)}>
                                                    {name}
                                                </span>
                                            );
                                        })
                                    }
                                </div>
                            </DropDownArea>
                        );
                    })

                }
            </Fragment>
        );
    }


    render() {
        return (
            <div>
                <DocHeader handleSearchInput={(text: string) => this.onSearchInput(text)} />

                {this.renderProgressRing()}

                <div id="doc-index-content">
                    {this.renderContent()}
                </div>

            </div>
        );
    }
}