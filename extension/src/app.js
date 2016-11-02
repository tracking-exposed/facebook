// # Welcome to the extension docs!
// Here you can learn how the extension works and, if this is what you aim for,
// where to put your hands to hack the code.
//
// ## Structure of the extension
// The extension has two parts:
//  - a content script
//  - event pages.
//
// The **content script** is the JavaScript code injected into the Facebook.com
// website. It can interact with the elements in the page to scrape the data and
// prepare the payload to be sent to the API.
//
// On the other side there are **event pages**. They are scripts triggered by
// some events sent from the **content script**. Since they run in *browser-space*,
// they have the permission (if granted) to do cross-domain requests, access
// cookies, and [much more](https://developer.chrome.com/extensions/declare_permissions).
// All **event pages** are contained in the [`./background`](./background/app.html) folder.
// (the name is **background** for historical reasons and it might be subject of changes
// in the future).

// # Code
// Import the styles for the app.
require('../styles/app.scss');

// Install any necessary polyfills into global, such as es6, stage/3, stage/4, etc. as needed
import 'core-js/es6';

// Import the react toolkit.
// Seems like importing 'react-dom' is not enough, we need to import 'react' as well.
import React from 'react';
import ReactDOM from 'react-dom';
import ReactDOMServer from 'react-dom/server';

// Import other utils to handle the DOM and scrape data.
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

// Boot the user script. This is the first function called.
// Everything starts from here.
function boot () {
    console.log(`Fbtrex version ${config.VERSION} build ${config.BUILD} loading.`);

    // Register all the event handlers.
    // An event handler is a piece of code responsible for a specific task.
    // You can learn more in the [`./handlers`](./handlers/index.html) directory.
    registerHandlers(hub);

    // Lookup the current user and decide what to do.
    userLookup(response => {
        // `response` contains the user's public key and its status,
        // if the key has just been created, the status is `new`.
        if (response.status === 'new') {
            // In the case the status is `new` then we need to onboard the user.
            onboarding(response.publicKey);
        } else {
            // Otherwise, we load all the components of the UI and the watchers.
            render();
            timeline();
            prefeed();
            watch();
            flush();
        }
    });
}

// The function `userLookup` communicates with the **action pages**
// to get information about the current user from the browser storage
// (the browser storage is unreachable from a **content script**).
function userLookup (callback) {
    // Extract the data from the DOM.
    const basicInfo = scrapeUserData($('body'));
    // Set the `userId` in the global configuration object.
    config.userId = basicInfo.id;
    // Propagate the data to all the handlers interested in that event.
    hub.event('user', basicInfo);
    // Finally, retrieve the user from the browser storage. This is achieved
    // sending a message to the `chrome.runtime`.
    chrome.runtime.sendMessage({
        type: 'userLookup',
        payload: {
            userId: config.userId
        }}, callback);
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

// The function `onboarding` guides the user through the public key
// registration.
// The flow is the following:
// 1. display a message at the top of the page. The message includes the
//    a public key and it prompts the user to copy paste it in a
//    new public post.
// 2. Wait until a post appears in the timeline.
// 3. Once the post appears, extract its permalink and send it to the API.
// 4. If the API call is successful, an **activity page** will update the
//    status of the key from `new` to `verified`.
function onboarding (publicKey) {
    // The first action is to display the big information box.
    $('#mainContainer').prepend($(ReactDOMServer.renderToString(
        <OnboardingBox publicKey={publicKey} />
    )));

    // Then we listen to all the new posts appearing on the user's timeline.
    document.arrive('#contentCol .userContentWrapper', function () {
        const $elem = $(this).parent();

        // Process the post only if its html contains the user's public key.
        if ($elem.html().indexOf(publicKey) !== -1) {
            // Extract the URL of the post.
            var permalink = $elem.find('[href^="/permalink.php"]')
                                 .attr('href');

            console.log('permalink', permalink);

            // Kindly ask to verify the user's public key against the API.
            // Since this is a cross domain request, we need to delegate the
            // call to an **action page**. If the call is successful, the action
            // page handling the event will update the status of the key in the
            // database. It will call the `verify` callback function as well.
            chrome.runtime.sendMessage({
                type: 'userVerify',
                payload: {
                    userId: config.userId,
                    publicKey: publicKey,
                    permalink: permalink
                }
            }, verify);
        }
    });
}

// This function checks the response from the verification API call.
// If the call is successful, it will reload the browser. This will restart
// this application as well, but instead of the onboarding the app will start
// scraping the posts.
function verify (response) {
    console.log(response);
    if (response === 'ok') {
        window.location.reload();
    }
}

boot();
