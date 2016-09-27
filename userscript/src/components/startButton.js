import React from 'react';

const StartButton = React.createClass({
    propTypes: {
        userId: React.PropTypes.string
    },

    render () {
        return (
            <a
                href={'https://facebook.tracking.exposed/realitycheck/' + this.props.userId}
                target='_blank'
                className='escvi--main-button'>
                ઉ
            </a>
        );
    }
});

export default StartButton;
