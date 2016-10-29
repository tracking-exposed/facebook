import React from 'react';

const VisualDebugBox = React.createClass({
    render () {
        const data = this.props.event.data;

        return (
            <div className='fbtrex--visual-debug'>
                <dl>
                    {Object.keys(data).map((key) => [
                        <dt>
                            {key}
                        </dt>,
                        <dd>
                            {JSON.stringify(data[key])}
                        </dd>
                    ])}
                </dl>
            </div>
        );
    }
});

export default VisualDebugBox;
