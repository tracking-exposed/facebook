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
it anyway. It's also a nice way to check if the installation succeeded.

`npm start` will build the application using `webpack` and watch for changes.


### Prepare your browser
If you wish to autoreload your extension every time a build succeeds, you need
first to install [Extension Reloader](https://chrome.google.com/webstore/detail/extensions-reloader/fimgfedafeadlieiabdeeaodndnlbhid).

To install the extension go to **settings**, select **extensions**, and enable
**Developer mode**. Click on **Load unpacked extension** and select the
`extension` directory contained in this repo.

Keep `npm start` running in the background to take advantage of the autoreload.


#### Ready to go!
Visit [Facebook](https://www.facebook.com/) and open the dev tools. You should
see some logging messages by **escvi**.

### Extend fixtures

 * You've to install the package `tidy` the last version in ubuntu is not working (we'll update the comment when fixed), use http://binaries.html-tidy.org/
 * Copy the userContentWrapper Element
 * save in file.html

```
tidy -i -m -w 0 -utf8 file.html
```

# Thanks
[@sohkai](https://github.com/sohkai) for the amazing [js-reactor
boilerplate](https://github.com/bigchaindb/js-reactor).


