// Install any necessary polyfills into global, such as es6, stage/3, stage/4, etc. as needed
/*
import 'core-js/es6';

import React from 'react';
import ReactDOM from 'react-dom';

// Replace as necessary with your own root app
const JsReactorApp = () => (
    <h1>JS Reactor App</h1>
);

// Replace as necessary with your root app and DOM element to inject into
ReactDOM.render((<JsReactorApp />), document.getElementById('js-reactor-app'));
*/

import 'arrive';
import { identify } from './scrape';

window.escvi = {};

window.escvi.boot = function () {
    console.log('ESCVI loading');
    window.escvi.watch();
};

window.escvi.watch = function () {
    document.arrive('.userContentWrapper', function () {
        console.log('new element', identify(this), this);
    });
};

window.escvi.boot();
