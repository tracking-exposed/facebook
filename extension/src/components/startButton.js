import hub from '../hub';
import React from 'react';

const StartButton = React.createClass({
    propTypes: {
        userId: React.PropTypes.string,
        count: React.PropTypes.number
    },

    getInitialState () {
        return { count: 0 };
    },

    componentDidMount () {
        hub.register('newPost', this.incCount);
    },

    incCount () {
        this.setState({ count: this.state.count + 1 });
    },

    render () {
        return (
            <a
                href={'https://facebook.tracking.exposed/realitycheck/' + this.props.userId}
                target='_blank'
                className='fbtrex--main-button'>
                ઉ {this.props.count}
            </a>
        );
    }
});

export default StartButton;
