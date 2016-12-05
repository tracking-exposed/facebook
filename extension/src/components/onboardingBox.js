import React from 'react';

const OnboardingBox = React.createClass({
    render () {
        const publicKey = this.props.publicKey;

        return (
            <div className='fbtrex--onboarding'>
                <h1>Welcome in facebook.tracking.exposed!</h1>
                <p>To get started, copy paste the following message in a new <strong>public post</strong>:</p>
                <p className='fbtrex--copypaste'>
                  Personalisation Algorithms are a collective issue, and can
                  only be collectively addressed; today I am joining
                  https://facebook.tracking.exposed and this technical
                  message is necessary to link my user to this key: {publicKey}
                </p>
                <p className='fbtrex--note'>
                  This box will disappear after we succesfully retrieve your key, <b>if do not disappear</b>, or you want talk about the project, join the <a href="https://www.facebook.com/personalizationalgorithm">facebook page</a> and check the <a href="https://facebook.tracking.exposed/beta" target="_blank">ß announcement</a>.
                </p>
            </div>
        );
    }
});

export default OnboardingBox;
