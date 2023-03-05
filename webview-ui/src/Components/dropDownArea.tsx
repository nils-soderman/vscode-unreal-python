import { Component } from "react";

interface DropDownAreaProps {
    title: string;
    children: any;
}
 
interface DropDownAreaState {
    
}
 
class DropDownArea extends Component<DropDownAreaProps, DropDownAreaState> {
    state = { }
    render() { 
        return ( 
            <div>
                <div>
                    <div className="arrow"></div>
                    <h2>{this.props.title}</h2>
                    
                    <div className="count-badge-wrapper">
                        <div className="count-badge">
                            { }
                        </div>
                    </div>

                    <div className="content">
                        {this.props.children}
                    </div>
                </div>
                
            </div>
         );
    }
}
 
export default DropDownArea;