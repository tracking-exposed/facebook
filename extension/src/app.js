// Install any necessary polyfills into global, such as es6, stage/3, stage/4, etc. as needed
//
require('../styles/app.scss');

import 'core-js/es6';

// Seems like importing 'react-dom' is not enough, we need to import 'react' as well.
import React from 'react';
import ReactDOM from 'react-dom';
import ReactDOMServer from 'react-dom/server';

// import nacl from 'tweetnacl';
import uuid from 'uuid';
import $ from 'jquery';
import 'arrive';
import { scrape, scrapeUserData } from './scrape';

import config from './config';
import hub from './hub';
import { getTimeISO8601 } from './utils';
import { registerHandlers } from './handlers/index';

import StartButton from './components/startButton';
import OnboardingBox from './components/onboardingBox';

function boot () {
    console.log(`Fbtrex version ${config.VERSION} build ${config.BUILD} loading.`);

    // Source handlers so they can process events
    registerHandlers(hub);

    userLookup(response => {
        if (response.isNew) {
            onboarding(response.publicKey);
        } else {
            render();
            timeline();
            prefeed();
            watch();
            flush();
        }
    });
}

function userLookup (callback) {
    const basicInfo = scrapeUserData($('body'));
    config.userId = basicInfo.id;
    hub.event('user', basicInfo);
    chrome.runtime.sendMessage({ type: 'userLookup', payload: { userId: config.userId }}, callback);
}

function timeline () {
    processTimeline();
    document.arrive('#feedx_container', processTimeline);
}

function prefeed () {
    document.querySelectorAll('#contentCol .userContentWrapper').forEach(processPost);
}

function watch () {
    document.arrive('#contentCol .userContentWrapper', function () { processPost(this); });
}

function render () {
    const rootElement = $('<div />', { 'id': 'fbtrex--root' });
    $('body').append(rootElement);
    ReactDOM.render((<StartButton userId={config.userId} />), document.getElementById('fbtrex--root'));
}

function flush () {
    window.addEventListener('beforeunload', (e) => {
        hub.event('windowUnload');
    });
}

function processPost (elem) {
    if (window.location.pathname !== '/') {
        console.debug('Skip post, not in main feed');
        return;
    }

    const $elem = $(elem).parent();
    var data;
    try {
        data = scrape($elem);
    } catch (e) {
        console.error(e, $elem);
    }

    if (data) {
        hub.event('newPost', { element: $elem, data: data });
    }
}

function processTimeline () {
    hub.event('newTimeline', { uuid: uuid.v4(), dt: getTimeISO8601() });
}

function onboarding (publicKey) {
    $('#mainContainer').prepend($(ReactDOMServer.renderToString(
        <OnboardingBox publicKey={publicKey} />
    )));

    document.arrive('#contentCol .userContentWrapper', function () {
        const $elem = $(this).parent();

        if ($elem.html().indexOf(publicKey) !== -1) {
            var permalink = $elem.find('[href^="/permalink.php"]')
                                 .attr('href');

            console.log('permalink', permalink);

            chrome.runtime.sendMessage({
                type: 'userRegistration',
                payload: {
                    publicKey: publicKey,
                    permalink: permalink
                }
            }, verify);
        }
    });
}

function verify () {
    console.log('verify');
    return;
    window.reload();
}

boot();
