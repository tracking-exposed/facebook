import React from 'react';

const OnboardingBox = React.createClass({
    render () {
        const publicKey = this.props.publicKey;

        return (
            <div className='fbtrex--onboarding'>
                <h1>Thanks for installing Fbtrex!</h1>
                <p>To get you started, copy paste the following message in a new <strong>public post</strong>:</p>

                <p className='fbtrex--copypaste'>
                    Personalisation Algorithms are a collective issue, and only
                    collectively they can be addressed; today I am joining
                    https://facebook.tracking.exposed and this technical
                    message is necessary to link my user to this key: {publicKey}
                </p>

                <p>This informative box will disappear after we succesfully retrieve your key.</p>
            </div>
        );
    }
});

export default OnboardingBox;
