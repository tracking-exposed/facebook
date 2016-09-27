// Install any necessary polyfills into global, such as es6, stage/3, stage/4, etc. as needed
//
require('../styles/app.scss');

import 'core-js/es6';
import React from 'react';
import ReactDOM from 'react-dom';

import $ from 'jquery';
import 'arrive';
import { identify } from './scrape';

import StartButton from './components/startButton';

function boot () {
    console.log('ESCVI loading!');
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
    const rootElement = $('<div />', { 'id': 'escvi--root' });

    $('body').append(rootElement);

    // Replace as necessary with your root app and DOM element to inject into
    ReactDOM.render((<StartButton />), document.getElementById('escvi--root'));
};

boot();
