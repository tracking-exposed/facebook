// Install any necessary polyfills into global, such as es6, stage/3, stage/4, etc. as needed
//
require('../styles/app.scss');

import 'core-js/es6';

// Seems like importing 'react-dom' is not enough, we need to import 'react' as well.
import React from 'react';
import ReactDOM from 'react-dom';

import $ from 'jquery';
import 'arrive';
import { scrapeBasicInfo, identify } from './scrape';

import StartButton from './components/startButton';

function boot () {
    console.log('FBTREX loading!');
    prefeed();
    watch();
    render();
};

function prefeed () {
    document.querySelectorAll('.userContentWrapper').forEach(function (elem) {
        console.log('new element', identify($(elem)), elem);
    });
};

function watch () {
    document.arrive('.userContentWrapper', function () {
        console.log('new element', identify($(this)), this);
    });
};

function render () {
    const rootElement = $('<div />', { 'id': 'fbtrex--root' });
    const basicInfo = scrapeBasicInfo($('body'));

    $('body').append(rootElement);
    ReactDOM.render((<StartButton userId={basicInfo.id} />), document.getElementById('fbtrex--root'));
};

boot();
