import "./docHeader.scss"

import React, { Component } from 'react';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';


class DocHeader extends Component {
    state = {}
    render() {
        return (
            <div>
                <h1 className="header">Documentation</h1>
                <VSCodeTextField id='searchbar' placeholder='Search...' />
            </div>
        );
    }
}


export default DocHeader;