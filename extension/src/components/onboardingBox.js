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
                <p>
                  This box will disappear after we succesfully retrieve your key. If you want to know more on the extension behavior, read the <a href="https://facebook.tracking.exposed/beta" target="_blank">ß announcement</a>.
                  <small>
                    <i><strong>Technical note</strong>: You can delete the post later. If you want modify the text, feel free to do it, just do not change the text "<strong>{publicKey}</strong>". That and the paired private key, would be saved in your local storage.</i>
                  </small>
                </p>
            </div>
        );
    }
});

export default OnboardingBox;
