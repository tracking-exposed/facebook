import React from 'react';

const VisualDebugBox = React.createClass({
    render () {
        return (
            <div>
                {this.props.event.data.href}
            </div>
        );
    }
});

export default VisualDebugBox;
