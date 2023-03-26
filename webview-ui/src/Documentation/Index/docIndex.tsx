import "./docIndex.scss";
import { Component, createRef, Fragment } from 'react';
import * as vscode from '../../Modules/vscode';
import DocHeader from './Header/docHeader';

import { VSCodeProgressRing } from '@vscode/webview-ui-toolkit/react';
import DropDownArea from "../../Components/DropDownArea/dropDownArea";
import DynamicList from "../../Components/DynamicList/dynamicList";


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

interface FilteredTableOfContents {
    [Type: string]: {
        prioritizedMatch: string[],
        items: string[]
    }
}


interface DocIndexProps {
    onItemClicked: (name: string) => void;
    onFilterChanged: (filter: string) => void;
    filter: string;
    scrollPosY: number;
}


export default class DocIndex extends Component<DocIndexProps> {
    state = { bLoading: true, tableOfContents: {}, filter: "" };

    contentRef: React.RefObject<HTMLDivElement>;
    numberOfDDAUpdates = 0;
    maxListItems: { [id: string]: number } = {};

    constructor(props: DocIndexProps) {
        super(props);

        this.state.filter = props.filter;
        this.contentRef = createRef();
    }

    async componentDidMount() {
        // Request the table of contents from the extension
        const tableOfContents: RawTableOfContents = await vscode.sendMessageAndWaitForResponse(vscode.EInOutCommands.getTableOfContents);
        this.maxListItems = await vscode.sendMessageAndWaitForResponse(vscode.EInOutCommands.getMaxListItems);

        const initialFilter = await vscode.sendMessageAndWaitForResponse(vscode.EInOutCommands.getInitialFilter);
        if (initialFilter) {
            this.applyFilter(initialFilter);
        }

        this.setState({
            tableOfContents: this.parseTableOfContents(tableOfContents),
            bLoading: false,
        });
    }

    onDropDownAreaUpdated(id: string) {
        if (this.numberOfDDAUpdates >= Object.keys(this.state.tableOfContents).length) {
            return;
        }
        this.numberOfDDAUpdates++;

        this.contentRef.current.scrollTo(0, this.props.scrollPosY);
        this.contentRef.current.scrollTop = this.props.scrollPosY;
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

    applyFilter(searchText: string) {
        this.setState({ filter: searchText });
        this.props.onFilterChanged(searchText);
    }

    /**
     * Callback for when the Show More button in a DynamicList is clicked
     */
    onListExpanded(id: string, maxItems: number) {
        vscode.sendMessage(vscode.EOutCommands.storeMaxListItems, { id, value: maxItems });
    }

    private passesFilter(itemName: string, includes: string[], alternativeIncludes?: string[]) {
        for (let include of includes) {
            if (!itemName.includes(include)) {
                if (alternativeIncludes)
                    return this.passesFilter(itemName, alternativeIncludes);

                return false;
            }
        }

        return true;
    }


    renderContent() {
        let content: FilteredTableOfContents = {};
        if (this.state.filter) {
            const filterLower = this.state.filter.toLocaleLowerCase();

            let includes = [];
            let alternativeIncludes: string[] | undefined = [];
            for (let part of this.state.filter.split(/[\s,]+/)) {
                const partLower = part.toLocaleLowerCase();
                includes.push(partLower);

                // Convert PascalCase to snake_case and use as alternatives, since the original C++ names are in PascalCase
                const partSnakeCase = part.replace(/([a-z])([A-Z])/g, (m, p1, p2) => `${p1}_${p2}`).toLowerCase();
                if (partSnakeCase !== partLower) {
                    alternativeIncludes.push(partSnakeCase);
                }
            }

            if (alternativeIncludes.length === 0) {
                alternativeIncludes = undefined;
            }

            for (let [type, items] of Object.entries(this.state.tableOfContents)) {
                content[type] = { items: [], prioritizedMatch: [] };

                for (let [className, memberName] of Object.entries(items)) {
                    const classNameLower = className.toLocaleLowerCase();
                    if (this.passesFilter(classNameLower, includes, alternativeIncludes)) {
                        // Check if it's a perfect match
                        if (classNameLower.startsWith(filterLower)) {
                            content[type].prioritizedMatch.push(className);
                        }
                        else {
                            content[type].items.push(className);
                        }
                    }

                    for (let member of memberName) {
                        const memberLower = member.toLocaleLowerCase();
                        if (this.passesFilter(memberLower, includes, alternativeIncludes)) {
                            const fullname = `${className}.${member}`;
                            if (memberLower.startsWith(filterLower)) {
                                content[type].prioritizedMatch.push(fullname);
                            }
                            else {
                                content[type].items.push(fullname);
                            }
                        }
                    }
                }

                content[type].prioritizedMatch.sort(function (a, b) {
                    return a.length - b.length;
                });

            }



        }
        else {
            for (let type in this.state.tableOfContents) {
                content[type] = {
                    items: Object.keys(this.state.tableOfContents[type]),
                    prioritizedMatch: []
                };
            }
        }

        return (
            <Fragment>
                {
                    Object.entries(content).map(([typeName, itemData], index) => {
                        return (
                            <DropDownArea key={index} id={`doc-index-${typeName}`} title={typeName} badgeCount={itemData.items.length + itemData.prioritizedMatch.length} onComponentUpdated={(id: string) => this.onDropDownAreaUpdated(id)}>
                                {
                                    (itemData.items.length + itemData.prioritizedMatch.length > 0) &&
                                    <div className="doc-index-dd-content">
                                        <DynamicList key={`dynamicList-${index}`} id={`dynamicList-${index}`} startingMaxChildren={this.maxListItems[`dynamicList-${index}`] || 50}
                                            increaseMaxChildrenStep={500} onListExpanded={(id, maxItems) => this.onListExpanded(id, maxItems)}>
                                            {
                                                [...itemData.prioritizedMatch, ...itemData.items].map((itemName, index) => {
                                                    return (
                                                        <span key={index} onClick={() => this.props.onItemClicked(itemName)}>
                                                            {itemName}
                                                        </span>
                                                    );
                                                })
                                            }
                                        </DynamicList>
                                    </div>
                                }
                            </DropDownArea>
                        );
                    })

                }
            </Fragment>
        );
    }


    render() {
        return (
            <Fragment>
                <DocHeader handleSearchInput={(text: string) => this.applyFilter(text)} filter={this.state.filter} />

                <div ref={this.contentRef} className="main-content" id="doc-index-content">
                    {this.renderProgressRing()}

                    {this.renderContent()}
                </div>

            </Fragment>
        );
    }
}