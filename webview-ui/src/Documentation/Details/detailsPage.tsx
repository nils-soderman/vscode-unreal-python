import "./detailsPage.scss";
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import { Component, Fragment } from "react";
import DropDownArea from "../../Components/dropDownArea";
import ReactMarkdown from 'react-markdown'
import * as vscode from '../../Modules/vscode';

const NONE_CLICKABLE_BASES = [
    "object",
    "_WrapperBase",
    "_ObjectBase",
]

interface PageTypeData {
    [type: string]: {
        name: string,
        doc: string,
        name_hints: string
    }[]
};

export interface PageData {
    pageData: {
        name: string,
        bases: string[],
        doc: string,
        members: {
            inherited: PageTypeData,
            unique: PageTypeData
        };
    },
    property?: string; // This is the property that was clicked when page was requested
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

    componentDidUpdate() {
        const element = document.getElementById("doc-details-highlight");
        if (element)
            element.scrollIntoView({inline: "center"});
    }

    async browseItem(name: string) {
        // Split by dot to get the object name and the member name
        let objectName = name;
        let memberName = undefined;
        if (name.indexOf(".") !== -1) {
            [objectName, memberName] = name.split(".");
        }

        const data = await vscode.sendMessageAndWaitForResponse(vscode.EInOutCommands.getDocPage, { "object": objectName, "property": memberName });
        this.setState({ data });
    }

    renderContent(data: PageTypeData, prefix = "") {
        return (
            <Fragment>
                {
                    Object.keys(data).map((type: string) => {
                        if (data[type].length === 0)
                            return null;

                        return (
                            <DropDownArea key={type} title={prefix + type}>
                                {
                                    data[type].map((member: any, index: number) => {
                                        return (
                                            <div key={index} className="doc-details-member" id={(this.state.data?.property === member.name ? "doc-details-highlight" : null)}>
                                                <h4>{member.name} <span className="doc-details-name-hint">{member.name_hints}</span></h4>
                                                <div className="doc-details-doc">
                                                    <ReactMarkdown>{member.doc}</ReactMarkdown>
                                                </div>
                                            </div>
                                        );
                                    })
                                }
                            </DropDownArea>
                        );
                    })
                }
            </Fragment>
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

                    <div className="doc-details-doc">
                        <ReactMarkdown>{data.doc}</ReactMarkdown>
                    </div>

                </div>

                <div>
                    {this.renderContent(this.state.data.pageData.members.unique)}
                    {this.renderContent(this.state.data.pageData.members.inherited, "Inherited ")}
                </div>
            </div>
        );
    }
}

export default DetailsPage;
