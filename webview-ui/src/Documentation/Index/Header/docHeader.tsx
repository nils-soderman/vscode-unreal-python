import "./docHeader.scss"

import { Component } from 'react';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';


class DocHeader extends Component {
    state = {}
    
    render() {
        return (
            <div className="header">
                <VSCodeTextField id='searchbar' placeholder='Search...' />
            </div>
        );
    }
}


export default DocHeader;