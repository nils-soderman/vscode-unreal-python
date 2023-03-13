import "./dropDownArea.scss";

import { Component } from "react";

interface DropDownAreaProps {
    title: string;
    children: any;
    badgeCount?: number;
    onHeaderClicked?: (bOpen: boolean) => void;
}

interface DropDownAreaState {
    bOpen: boolean
}

class DropDownArea extends Component<DropDownAreaProps, DropDownAreaState> {
    state = { bOpen: true }

    onHeaderClicked() {
        const bOpen = !this.state.bOpen;

        this.setState({ bOpen });

        if (this.props.onHeaderClicked) {
            this.props.onHeaderClicked(bOpen);
        }
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