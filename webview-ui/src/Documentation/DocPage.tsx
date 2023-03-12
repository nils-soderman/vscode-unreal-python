import { Component } from 'react';
import DetailsPage from './Details/detailsPage';
import DocIndex from './Index/docIndex';


export default class DocPage extends Component {
    state = { detailsPageItem: null }

    browseItem(name: string) {
        this.setState({ detailsPageItem: name });
    }

    backToIndex() {
        this.setState({ detailsPageItem: null });
    }

    render() {
        if (this.state.detailsPageItem) {
            return (<DetailsPage item={this.state.detailsPageItem} onBackClicked={() => this.backToIndex()}></DetailsPage>);
        }

        return (
            <DocIndex onItemClicked={(item: string) => this.browseItem(item)} />
        );
    }
}