import "./docHeader.scss"

import { Component } from 'react';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';

interface Props {
    handleSearchChanged?: CallableFunction,
    handleSearchInput?: CallableFunction
}

interface State {
}

class DocHeader extends Component<Props, State> {
    state = {}

    render() {
        return (
            <div className="doc-index-header">
                {/* Callback OnInput: typehint variable e */}
                <VSCodeTextField id='searchbar' placeholder='Search documentation...' onInput={(e) => { if (this.props.handleSearchInput) this.props.handleSearchInput(e.target.value) }} />
            </div>
        );
    }
}


export default DocHeader;