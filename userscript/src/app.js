// Install any necessary polyfills into global, such as es6, stage/3, stage/4, etc. as needed
//
require('../styles/app.scss');

import 'core-js/es6';

// Seems like importing 'react-dom' is not enough, we need to import 'react' as well.
import React from 'react';
import ReactDOM from 'react-dom';

import uuid from 'uuid';
import $ from 'jquery';
import 'arrive';
import { scrape, scrapeUserData } from './scrape';

import config from './config';
import { getTimeISO8601 } from './utils';
import { HUB } from './hub';
import { registerHandlers } from './handlers/index';

import StartButton from './components/startButton';

function boot () {
    console.log(`Fbtrex version ${config.VERSION} build ${config.BUILD} loading.`);

    // Source handlers so they can process events
    registerHandlers(HUB);

    timeline();
    prefeed();
    watch();
    render();
    flush();
};

function timeline () {
    processTimeline();
    document.arrive('#feedx_container', processTimeline);
}

function prefeed () {
    document.querySelectorAll('.userContentWrapper').forEach(processPost);
};

function watch () {
    document.arrive('.userContentWrapper', function () { processPost(this); });
};

function render () {
    const rootElement = $('<div />', { 'id': 'fbtrex--root' });
    const basicInfo = scrapeUserData($('body'));

    $('body').append(rootElement);
    ReactDOM.render((<StartButton userId={basicInfo.id} />), document.getElementById('fbtrex--root'));
};

function flush () {
    window.addEventListener('beforeunload', (e) => {
        HUB.event('windowUnload');
    });
}

function processPost (elem) {
    if (window.location.href !== 'https://www.facebook.com/') {
        console.debug('Skip post, not in main feed');
        return;
    }

    const $elem = $(elem).parent();
    const data = scrape($elem);

    if (data) {
        HUB.event('newPost', { element: $elem, data: data });
    }
};

function processTimeline () {
    HUB.event('newTimeline', { uuid: uuid.v4(), dt: getTimeISO8601() });
}

boot();
