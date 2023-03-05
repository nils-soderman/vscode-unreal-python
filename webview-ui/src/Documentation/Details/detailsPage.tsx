import "./detailsPage.scss";
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import { Component } from "react";
import DropDownArea from "../../Components/dropDownArea";
import ReactMarkdown from 'react-markdown'
import * as vscode from '../../Modules/vscode';

const NONE_CLICKABLE_BASES = [
    "object",
    "_WrapperBase",
    "_ObjectBase",
]

export interface PageData {
    pageData: {
        name: string,
        bases: string[],
        doc: string,
        members: {
            inherited: {
                [type: string]: {
                    name: string,
                    doc: string,
                }[]
            },
            unique: {
                [type: string]: {
                    name: string,
                    doc: string,
                }[]
            }
        };
        property?: string;
    }
}

interface DetailsPageProps {
    item: string;
    onBackClicked: () => void;
}

interface DetailsPageState {
    data?: PageData;
}


class DetailsPage extends Component<DetailsPageProps, DetailsPageState> {
    state = { data: undefined }

    async componentDidMount() {
        this.browseItem(this.props.item);
    }

    async browseItem(name: string) {
        // Split by dot to get the object name and the member name
        let objectName = name;
        let memberName = undefined;
        if (name.indexOf(".") !== -1) {
            [objectName, memberName] = name.split(".");
        }

        const data = await vscode.sendMessageAndWaitForResponse(vscode.EInOutCommands.getDocPage, { "object": objectName, "property": memberName });
        console.log(data);
        this.setState({ data });
    }

    renderContent() {
        const data: PageData = this.state.data;
        const pageData = data.pageData;
        return (
            <div>
                {
                    Object.keys(pageData.members.unique).map((type: string) => {
                        if (pageData.members.unique[type].length === 0)
                            return null;

                        return (
                            <DropDownArea key={type} title={type}>
                                <ul>
                                    {
                                        pageData.members.unique[type].map((member: any, index: number) => {
                                            return (
                                                <li key={index}>
                                                    <h4>{member.name}</h4>
                                                    <p className="doc">
                                                        {member.doc}
                                                    </p>
                                                </li>
                                            );
                                        })
                                    }
                                </ul>
                            </DropDownArea>
                        );
                    })
                }
            </div>
        );

    }

    render() {
        if (!this.state.data) {
            return (
                <div id="loading">
                    <VSCodeProgressRing />
                </div>
            );
        }

        const data = this.state.data.pageData;

        return (
            <div>
                <div id="doc-details-header">
                    <div className="link" onClick={this.props.onBackClicked}>&lt; Back</div>

                    <h1 id="doc-details-title">
                        {data.name}
                    </h1>

                    <div id="bases">
                        <span>Bases: </span>
                        {
                            data.bases.map((base: string, index: number) => {
                                return (
                                    <span key={index}>
                                        <span className={NONE_CLICKABLE_BASES.includes(base) ? "" : "link"} onClick={() => this.browseItem(base)}>{base}</span>
                                        {index !== data.bases.length - 1 ? "> " : ""}
                                    </span>
                                );
                            })
                        }
                    </div>

                    <p id="doc">
                        <ReactMarkdown>{data.doc}</ReactMarkdown>
                    </p>

                </div>

                <div>
                    {this.renderContent()}
                </div>
            </div>
        );
    }
}

export default DetailsPage;
