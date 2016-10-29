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
                            { (typeof data[key] === 'object') ? 
                              JSON.stringify(data[key]) : data[key]
                            }
                        </dd>
                    ])}
                </dl>
            </div>
        );
    }
});

export default VisualDebugBox;
