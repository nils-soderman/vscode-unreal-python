import { Component } from 'react';
import DetailsPage from './Details/detailsPage';
import DocIndex from './Index/docIndex';


export default class DocPage extends Component {
    state = { detailsPageItem: null }

    cachedFilter = "";
    cachedScrollPosY = 0;

    browseItem(name: string) {
        this.setState({ detailsPageItem: name });

        const scrollElement = document.getElementById("doc-index-content");
        if (scrollElement) {
            this.cachedScrollPosY = scrollElement.scrollTop;
        }
    }

    backToIndex() {
        this.setState({ detailsPageItem: null });
    }

    onFilterChanged(filter: string) {
        this.cachedFilter = filter;
    }

    render() {
        if (this.state.detailsPageItem) {
            return (<DetailsPage item={this.state.detailsPageItem} onBackClicked={() => this.backToIndex()}></DetailsPage>);
        }

        return (
            <DocIndex filter={this.cachedFilter} onItemClicked={(item: string) => this.browseItem(item)}  onFilterChanged={(filter: string) => this.onFilterChanged(filter)} scrollPosY={this.cachedScrollPosY} />
        );
    }
}