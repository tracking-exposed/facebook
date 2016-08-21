# Userscript
This directory contains the JavaScript code running in
Tampermonkey/Greasemonkey and the build system to develop it and create
distributions.


# Dependencies
Requires Node 5+. Install [nvm](https://github.com/creationix/nvm) if you
haven't already.


## Getting Started
Setting up the dev environment requires few steps (the process will be
simplified when I find a nicer way to do cache busting to load the script,
until now please read the following instructions):


### Prepare your build system
The build system uses a simple `package.json` file to describe the tasks.

To get started run:
```
npm install
npm test
npm start
```

The second line (`npm test`) is optional, but testing is cool and you should do
it anyway. It's also a nice way to test if the installation succeeded.

`npm start` will boot the `webpack-dev-server` to recompile and serve our
userscript extension.


### Prepare your browser
I warn you: this is partially painful.

We want to be able to code our extension *outside* the Greasemonkey environment
and be able to inject the new script in the browser as soon as we change a
file. Unfortunately resources imported with the `@require` directive are
cached. To overcome that we need to add manually a `<script>` tag pointing to a
file located in `localhost:3000/assets/bundle.js`, and add cache
busting to the resource.


#### Install the proxy script
We need to tell Greasemonkey to dinamically load our script.

Open Greasemonkey and add this code:

```
// ==UserScript==
// @name         escvi-proxy
// @namespace    https://github.com/vecna/escvi
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://www.facebook.com/*
// @grant        none
// @noframes
// ==/UserScript==

(function() {
    'use strict';
    var script = document.createElement('script');
    script.src = 'https://localhost:3000/assets/bundle.js?' + Math.random();
    script.type = 'text/javascript';
    document.getElementsByTagName('head')[0].appendChild(script);
})();
```

Note: this won't work out of the box! Read carefully the next two sections.

#### Fighting the CSP
Facebook implements a [Content Security
Policy](https://content-security-policy.com/) that disallow loading resources
from other domains. This policy is transmitted over an http header, and it
looks like this:

```
content-security-policy: default-src * data: blob:;script-src *.facebook.com
*.fbcdn.net *.facebook.net *.google-analytics.com *.virtualearth.net
*.google.com 127.0.0.1:* *.spotilocal.com:* 'unsafe-inline' 'unsafe-eval'
fbstatic-a.akamaihd.net fbcdn-static-b-a.akamaihd.net *.atlassolutions.com
blob: data:;style-src * 'unsafe-inline' data:;connect-src *.facebook.com
*.fbcdn.net *.facebook.net *.spotilocal.com:* *.akamaihd.net
wss://*.facebook.com:* https://fb.scanandcleanlocal.com:* *.atlassolutions.com
attachment.fbsbx.com ws://localhost:* blob:
chrome-extension://boadgeojelhgndaghljhdicfkmllpafd
chrome-extension://dliochdbjfkdbacpmhlcpmleaejidimm;
```

At the time of writing the easiest option to get rid of this limitation is to
install the Chrome extension [Content Security
Policy](https://chrome.google.com/webstore/detail/disable-content-security/ieelmcmcagommplceebfedjlakkhpden)


#### Use HTTPS
Disabling the CSP is not enough. Since Facebook runs under `https`, the only
way to load the script is to serve it through `https` as well.
The development server can handle `https` requests, but first you must accept
the self signed certificate from the browser.

Visit
[https://localhost:3000/assets/bundle.js](https://localhost:3000/assets/bundle.js)
to accept the certificate.


#### Ready to go!
Visit [Facebook](https://www.facebook.com/) and open the dev tools. You should
see some logging messages by **escvi**.

# Thanks
[@sohkai](https://github.com/sohkai) for the amazing [js-reactor
boilerplate](https://github.com/bigchaindb/js-reactor).

