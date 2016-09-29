# Userscript
This directory contains the JavaScript code running in
Tampermonkey/Greasemonkey and the build system to develop it and create
distributions.

We use ECMAScript 2015, aka ES6, aka ECMAScript Harmony. The aim is to keep the
code modular, easy to test, and beautiful.


# Dependencies
Requires Node 5+. Install [nvm](https://github.com/creationix/nvm) if you
haven't already.


## Getting Started
Setting up the dev environment is super easy.


### Set up your build system
The build system uses a simple `package.json` file to describe the tasks.

To get started run:
```
npm install
npm test
npm start
```

The second line (`npm test`) is optional, but testing is cool and you should do
it anyway. It's also a nice way to test if the installation succeeded.

`npm start` will build the application using `webpack` and watch for changes.


### Prepare your browser
Developing the extension happens *outside* the Greasemonkey environment.
We need to tell Greasemonkey to load the script from the filesystem,
specifically the one built with `npm start`.

Open Greasemonkey and add this code:

```
// ==UserScript==
// @name         test-local-require
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://www.facebook.com/*
// @require      file:///path/to/ESCVI/userscript/build/bundle.js
// @resource     escviStyle file:///path/to/ESCVI/userscript/build/styles.css
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @noframes
// ==/UserScript==

var newCSS = GM_getResourceText('escviStyle');
GM_addStyle(newCSS);
```

Remember to point the `@require` to the correct location of the "bundle" in
your filesystem.

Now you need to enable the option **Allow access to file URLs**. Open the
Chrome menu, go to **More tools**, then **Extensions**, search for
**Tampermonkey** in the list of extensions, and click "**Allow access to file URLs**.

#### Ready to go!
Visit [Facebook](https://www.facebook.com/) and open the dev tools. You should
see some logging messages by **escvi**.

# Thanks
[@sohkai](https://github.com/sohkai) for the amazing [js-reactor
boilerplate](https://github.com/bigchaindb/js-reactor).

