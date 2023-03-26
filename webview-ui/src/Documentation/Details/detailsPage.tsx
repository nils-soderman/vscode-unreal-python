import "./detailsPage.scss";
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import { Component, Fragment } from "react";
import DropDownArea from "../../Components/DropDownArea/dropDownArea";
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
        },
        is_class: boolean
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

    objectName: string = "";

    async componentDidMount() {
        this.browseItem(this.props.item);
    }

    componentDidUpdate() {
        const element = document.getElementById("doc-details-highlight");
        if (element)
            element.scrollIntoView({ inline: "center" });
    }

    async browseItem(name: string) {
        // Split by dot to get the object name and the member name
        this.objectName = name;
        let memberName = undefined;
        if (name.indexOf(".") !== -1) {
            [this.objectName, memberName] = name.split(".");
        }

        const data = await vscode.sendMessageAndWaitForResponse(vscode.EInOutCommands.getDocPage, { "object": this.objectName, "property": memberName });
        this.setState({ data });
    }

    renderContent(data: PageTypeData, prefix = "") {
        // Get the property that was clicked when the page was requested, to focus on it
        let focusPropertyName = this.state.data?.property;
        if (!focusPropertyName && !this.state.data?.pageData.is_class) {
            focusPropertyName = this.objectName;
        }
        
        return (
            <Fragment>
                {
                    Object.keys(data).map((type: string) => {
                        if (data[type].length === 0)
                            return null;

                        // Check if DropDownArea needs to be forced open (if the focused property is in this type)
                        let bForceOpenState: boolean = undefined;
                        if (focusPropertyName) {
                            if (data[type].find((member: any) => member.name === focusPropertyName))
                                bForceOpenState = true;
                        }

                        return (
                            <DropDownArea key={type} id={`doc-details-${prefix + type}`} title={prefix + type} bForceOpenState={bForceOpenState}>
                                {
                                    data[type].map((member: any, index: number) => {
                                        return (
                                            <div key={index} className="doc-details-member" id={(focusPropertyName === member.name ? "doc-details-highlight" : null)}>
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
            <Fragment>
                <div className="vscode-header">
                    <div className="link" onClick={this.props.onBackClicked}>&lt; Back</div>
                </div>
                <div className="main-content">
                    <div id="doc-details-header">

                        <h1 id="doc-details-title">
                            {data.name}
                        </h1>
                        {
                            data.bases.length > 0 &&
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
                        }

                        <div className="doc-details-doc">
                            <ReactMarkdown>{data.doc}</ReactMarkdown>
                        </div>

                    </div>

                    <div>
                        {this.renderContent(this.state.data.pageData.members.unique)}
                        {this.renderContent(this.state.data.pageData.members.inherited, "Inherited ")}
                    </div>
                </div>
            </Fragment>
        );
    }
}

export default DetailsPage;
