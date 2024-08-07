import "./dropDownArea.scss";
import * as vscode from "../../Modules/vscode";

import { Component } from "react";

interface DropDownAreaProps {
    title: string;
    children: any;
    id: string;
    badgeCount?: number;
    onHeaderClicked?: (id: string, bOpen: boolean) => void;
    bForceOpenState?: boolean;
    onComponentUpdated?: (id: string) => void;
}

interface DropDownAreaState {
    bOpen: boolean
}

class DropDownArea extends Component<DropDownAreaProps, DropDownAreaState> {
    state = { bOpen: false }

    constructor(props: DropDownAreaProps) {
        super(props);
        if (props.bForceOpenState !== undefined)
            this.state.bOpen = props.bForceOpenState;
    }

    onHeaderClicked() {
        const bOpen = !this.state.bOpen;

        this.setState({ bOpen });

        vscode.sendMessage(vscode.EOutCommands.storeDropDownAreaOpenState, { id: this.props.id, value: bOpen });

        if (this.props.onHeaderClicked) {
            this.props.onHeaderClicked(this.props.id, bOpen);
        }
    }

    async componentDidMount() {
        if (this.props.bForceOpenState !== undefined)
            return;

        const data = await vscode.sendMessageAndWaitForResponse(vscode.EInOutCommands.getDropDownAreaOpenStates, this.props.id);

        let bOpen = data[this.props.id];
        if (bOpen === undefined)
            bOpen = true;

        this.setState({ bOpen });
    }

    componentDidUpdate(prevProps: DropDownAreaProps) {
        if (this.props.onComponentUpdated)
            this.props.onComponentUpdated(this.props.id);
    }


    getArrowClass() {
        return "arrow " + (this.state.bOpen ? "down" : "right");
    }

    render() {
        return (
            <div>
                <div className="dd-area-header" onClick={() => this.onHeaderClicked()}>
                    <div className={this.getArrowClass()}></div>

                    <h2>{this.props.title}</h2>

                    {
                        this.props.badgeCount !== undefined &&
                        <div className="dd-area-badge-wrapper">
                            <div className="dd-area-badge">
                                {this.props.badgeCount}
                            </div>
                        </div>
                    }

                </div>
                {
                    this.state.bOpen && this.props.children &&
                    <div className="dd-content">
                        {this.props.children}
                    </div>
                }
            </div>
        );
    }
}

export default DropDownArea;