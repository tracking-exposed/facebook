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

window.escvi = {};

window.escvi.boot = function() {
    console.log('Hello app.js');
};

window.escvi.boot();
