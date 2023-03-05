import "./container.scss";
import { Component } from "react";

interface Props {
    name: string;
    contents: {
        [name: string]: string[];
    },
    filter: string,
    
    onItemClicked?: (name: string) => void;
}

interface State {
    bOpen: boolean
}

class Container extends Component<Props, State> {
    state = { bOpen: true }

    getArrowClassName() {
        return "arrow " + (this.state.bOpen ? "down" : "right");
    }

    toggleOpen() {
        this.setState({ bOpen: !this.state.bOpen });
    }

    renderContent() {
        return (
            <div className="content">
                {Object.keys(this.props.contents).map((key) => {
                    return (
                        <span onClick={() => this.props.onItemClicked(key)}>
                            {key}
                        </span>
                    )
                })}
            </div>
        )
    }

    render() {
        return (
            <div id="section">

                <div className="category-header" onClick={() => this.toggleOpen()}>
                    <div className={this.getArrowClassName()}></div>
                    <h2>{this.props.name}</h2>

                    <div className="count-badge-wrapper">
                        <div className="count-badge">
                            {Object.keys(this.props.contents).length}
                        </div>
                    </div>

                </div>

                {this.state.bOpen && this.renderContent()}
            </div>
        );
    }
}


export default Container;