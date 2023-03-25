import "./dynamicList.scss";

import { Component, Fragment, ReactNode } from "react";

interface DynamicListProps {
    children: any[];
    startingMaxChildren: number;
    increaseMaxChildrenStep: number;
    id: string;
    onListExpanded?: (id: string, maxItems: number) => void;
}

interface DynamicListState {
    maxChildren: number;
}

class DynamicList extends Component<DynamicListProps, DynamicListState> {
    state = { maxChildren: 100 }

    constructor(props: DynamicListProps) {
        super(props);

        this.state.maxChildren = props.startingMaxChildren;
    }

    onShowMoreClicked() {
        const maxChildren = this.state.maxChildren + this.props.increaseMaxChildrenStep;
        
        this.setState({ maxChildren });

        if (this.props.onListExpanded) {
            this.props.onListExpanded(this.props.id, maxChildren);
        }
    }

    render(): ReactNode {
        let childItems = this.props.children;
        const bSpliceNeeded = this.props.children.length > this.state.maxChildren;
        if (bSpliceNeeded) {
            childItems = this.props.children.slice(0, this.state.maxChildren);
        }

        return (
            <Fragment>
                {
                    childItems.map((child, index) => {
                        return child;
                    })
                }
                {
                    // Show a button allowing the user to show more items
                    bSpliceNeeded && (
                        <div className="dynamic-list-show-more-button" onClick={() => this.onShowMoreClicked()}>
                            Show more...
                        </div>
                    )
                }
            </Fragment>
        );
    }
}

export default DynamicList;