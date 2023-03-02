import "./container.scss";
import { Component } from "react";

interface Props {
    name: string;
}

interface State {

}

class Container extends Component<Props, State> {
    state = {}

    render() {
        return (
            <div id="section">

                <div className="category-header">
                    <div className="arrow right"></div>
                    <h2>{this.props.name}</h2>

                </div>

                <div className="content">
                </div>
            </div>
        );
    }
}


export default Container;