import "./docHeader.scss"

import { Component, createRef } from 'react';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';

interface Props {
    handleSearchChanged?: CallableFunction,
    handleSearchInput?: CallableFunction
}

interface State {
}

class DocHeader extends Component<Props, State> {
    state = {}
    
    textField = createRef<HTMLDivElement>();

    componentDidUpdate() {
        // TODO: Because 'autofocus' is currently broken w/ webview-ui-toolkit/react
        // Swap to using autofocus when this is fixed: https://github.com/microsoft/vscode-webview-ui-toolkit/issues/381
        const shadowRoot = this.textField.current.shadowRoot;
        if (shadowRoot) {
            const input = shadowRoot.querySelector('input');
            if (input) {
                input.focus();
            }
        }
    }

    render() {
        return (
            <div className="doc-index-header">
                {/* Callback OnInput: typehint variable e */}
                <VSCodeTextField autofocus id='searchbar' placeholder='Search documentation...' onInput={(e) => { if (this.props.handleSearchInput) this.props.handleSearchInput(e.target.value) }} ref={this.textField}/>
            </div>
        );
    }
}


export default DocHeader;