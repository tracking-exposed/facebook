import React from 'react';

const StartButton = React.createClass({
    propTypes: {
        userId: React.PropTypes.number
    },

    render () {
        return (
            <a
                href={'https://facebook.tracking.exposed/realitycheck/' + this.props.userId}
                className='escvi--main-button'>
                ઉ
            </a>
        );
    }
});

export default StartButton;
