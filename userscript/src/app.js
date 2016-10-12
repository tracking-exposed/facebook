// Install any necessary polyfills into global, such as es6, stage/3, stage/4, etc. as needed
//
require('../styles/app.scss');

import 'core-js/es6';

// Seems like importing 'react-dom' is not enough, we need to import 'react' as well.
import React from 'react';
import ReactDOM from 'react-dom';

import $ from 'jquery';
import 'arrive';
import { scrape } from './scrape';

import { HUB } from './hub';
import { registerHandlers } from './handlers/index';

import StartButton from './components/startButton';

function boot () {
    console.log('FBTREX loading!');

    // Source handlers so they can process events
    registerHandlers(HUB);

    prefeed();
    watch();
    render();
};

function prefeed () {
    document.querySelectorAll('.userContentWrapper').forEach(function (elem) {
        const $elem = $(elem).parent();
        const data = scrape($elem);
        if (data) {
            HUB.event('newPost', {'element': $elem, 'data': data });
        }
    });
};

function watch () {
    document.arrive('.userContentWrapper', function () {
        const $elem = $(this).parent();
        const data = scrape($elem);
        if (data) {
            HUB.event('newPost', {'element': $elem, 'data': data });
        }
    });
};

function render () {
    const rootElement = $('<div />', { 'id': 'fbtrex--root' });
    const basicInfo = scrape($('.fbxWelcomeBoxName').parent());

    $('body').append(rootElement);
    ReactDOM.render((<StartButton userId={basicInfo.id} />), document.getElementById('fbtrex--root'));
};

boot();
