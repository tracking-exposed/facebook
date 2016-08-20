JS Reactor
==========
[![Dependency Status](https://david-dm.org/bigchaindb/js-reactor.svg)](https://david-dm.org/bigchaindb/js-reactor)
[![devDependency Status](https://david-dm.org/bigchaindb/js-reactor/dev-status.svg)](https://david-dm.org/bigchaindb/js-reactor#info=devDependencies)
[![Code style](https://img.shields.io/badge/code%20style-ascribe-brightgreen.svg)](https://github.com/ascribe/javascript)
[![Join the chat at https://gitter.im/bigchaindb/bigchaindb](https://badges.gitter.im/bigchaindb/bigchaindb.svg)](https://gitter.im/bigchaindb/bigchaindb?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

Minimalistic boilerplate to power your next React app.

[See what's provided](#whats-included) and [why we bothered](#yet-another-react-boilerplate).


Getting started
---------------

#### Initialize a new repository

Just clone or fork this repo, `rm -rf .git` inside the repo, and `git init` to start your new
project using this boilerplate as a base.

More literally:

```bash
# If you'd like, fork js-reactor and clone your fork locally
$ git clone git@github.com:<forked-by-user>/js-reactor.git your-project

# Or, just straight up clone this repo
$ git clone git@github.com:bigchaindb/js-reactor.git your-project

# And reinitialize the repo
$ cd your-project
$ rm -rf .git && git init
$ git add . && git commit -m "Initial commit"
```

This will clone this repository into `your-project/` and initialize a new git repository for you to
start working in.

#### Start hacking

Open `src/app.js` to start working on the app. A demo server with hot reloading is provided out of
the box, so you can immediately see what you're building.

```bash
$ npm install
$ npm start     # By default runs on localhost:3000

$ vim src/app.js
```

#### Additional setup

Some Good Things~~<sup>TM</sup>~~ you may be interested in doing:

* Replace some of the values in [package.json](./package.json), specifically:
    * `name` - [Your project's name](https://docs.npmjs.com/files/package.json#name)
    * `version` - [Your project's version](https://docs.npmjs.com/files/package.json#version)
    * `description` - [A description of your project](https://docs.npmjs.com/files/package.json#description-1)
    * `homepage` - [Your project's homepage](https://docs.npmjs.com/files/package.json#homepage)
    * `bugs` - [Where people should go for help](https://docs.npmjs.com/files/package.json#bugs)
    * `authors` - [Authors of your project](https://docs.npmjs.com/files/package.json#people-fields-author-contributors)
    * `repository` - [Your project's online repository](https://docs.npmjs.com/files/package.json#repository)
* Replace this README.md with your own project's
* If desired, select your own license (replace LICENSE.md and package.json's `license`)
* Use a more appropriate element to render your app into (see [app.js](src/app.js#L14) and the demo
  [index.html](demo/index.html#L13))
* Add tests (and add npm scripts for testing)
* Look at [extending the initial Webpack features](#optional-addons--tips)


Dependencies
------------

Requires Node 5+. Install [nvm](https://github.com/creationix/nvm) if you haven't already.


What's Included
---------------

* [Babel 6](http://babeljs.io/)
    * [See .babelrc config](./.babelrc)
* [Webpack 2](https://webpack.github.io/)
    * [See webpack.config.js config](./webpack.config.js)
        * JS loader with Babel
        * CSS loader
        * Source maps
        * [Production build settings](#production-settings)
    * [Dev server](https://github.com/webpack/webpack-dev-server)
        * [See server.demo.js config](./server.demo.js)
* [Autoprefixer](https://github.com/postcss/autoprefixer)
    * [See browserlist for initial browser support](./browserlist)
* [ESLint](http://eslint.org/) + [ESLint-plugin-react](https://github.com/yannickcr/eslint-plugin-react)
    * Based on [eslint-config-ascribe-react](https://github.com/ascribe/javascript/tree/master/packages/eslint-config-ascribe-react);
      [see .eslintrc.json config](./.eslintrc.json)
* [React hot reloading](https://github.com/gaearon/babel-plugin-react-transform)

#### Initial app structure

A small barebones app is provided in `src/app.js`. The initial Webpack config expects this to be the
root of the app and uses it as its [entry point](https://webpack.github.io/docs/configuration.html#entry).

The demo app (`demo/app.js`) just imports the app at `src/app.js`, which, when run, will be
rendered into `demo/index.html` through the `#js-reactor-app` element.

#### Npm scripts

Pretty basic stuff:

* `npm start`: Start Webpack dev server with hot reloading
* `npm run build`: Build project into `build/`
* `npm run build:dist`: Build project with production settings into `dist/`
* `npm run lint`: Lint entire project

#### Production settings

Some standard fare:

* Use `NODE_ENV=PRODUCTION` environment variable for building
* Bundle, uglify, and minimize JS + CSS
* Extract CSS out from JS
* Extract source maps from bundles


Optional Addons / Tips
----------------------

In the interest of Keeping Things Simple~~<sup>TM</sup>~~, the initial [webpack
config](./webpack.config.js) was kept rather barebones. It can only understand Javascript files
(`.js` or `.jsx`) and CSS files (`.css`).

Here are some other nice things you can include, if desired.

#### Build systems

We've kept it simple with npm scripts, but if you like Gulp / Grunt / etc, feel free to integrate
Webpack with them.

#### Using environment variables

Webpack provides the [define plugin](https://github.com/webpack/docs/wiki/list-of-plugins#defineplugin)
to inject free variables into your builds.

Initially, `NODE_ENV` is already defined and passed into your builds, so you can use it by
referencing `process.env.NODE_ENV`. This is a great way to handle logic surrounding debug and
production modes, as Webpack can do dead code elimination during production builds
([see the docs](https://github.com/webpack/docs/wiki/list-of-plugins#defineplugin)). To make things
more streamline, you may also consider using [warning](https://github.com/BerkeleyTrue/warning) and
[babel-plugin-dev-expression](https://github.com/4Catalyzer/babel-plugin-dev-expression).

To inject more variables like this, add definitions to the [DEFINITIONS object](./webpack.config.js#L24).

#### Browser support

See the [browserlist](./browserlist) for the default list of supported browsers (used by Autoprefixer).

If you'd like to include support for IE8 and lower, you should also disable UglifyJSPlugin's
`screw_ie8` flag in the webpack configuration.

#### Sass / SCSS

Install some of the Sass utilities:

```bash
npm install -D node-sass sass-loader
```

And add [sass-loader](https://github.com/jtangelder/sass-loader) to your Webpack loaders, with the
test `/\.s[ac]ss$/`, using these settings:

```js
{
    loader: 'sass',
    query: {
        precision: '8', // If you use bootstrap, must be >= 8. See https://github.com/twbs/bootstrap-sass#sass-number-precision
        outputStyle: 'expanded',
        sourceMap: true
    },
},
```

Assuming you're not going to use plain CSS anymore, you can edit your `webpack.config.js`'s
`CSS_LOADERS` to look something like:

```js
const CSS_LOADER = combineLoaders([
    {
        loader: 'css',
        // ...
    },
    { loader: 'postcss' },
    {
        loader: 'sass',
        query: {
            precision: '8', // See https://github.com/twbs/bootstrap-sass#sass-number-precision
            outputStyle: 'expanded',
            sourceMap: true
        }
    },
    // ...
]);
```

And now replace the `css` loader specification's test (`test: /\.css$/`), with `test: /\.s[ac]ss$/`.

#### LESS

See [less-loader](https://github.com/webpack/less-loader), with a set up that is likely very similar
to [sass-loader](#sass-less).

#### PostCSS

Install the PostCSS plugins via npm, and add them to the `postcss` array in the [Webpack
config](./webpack.config.js#L115). When in doubt, refer back to the plugin's documentation.

#### CSS Modules

Modify the [css-loader](https://github.com/webpack/css-loader) with something like:

```js
{
    loader: 'css',
    query: {
        modules: true,
        importLoaders: 2, // NOTE: This must be the number of loaders after this (ie. 2 if you have postcss-loader and sass-loader chained after)
        localIdentName: '[path]__[name]__[local]_[hash:base64:5]',
        sourceMap: true
    },
},
```

Assuming you're not going to use CSS without CSS Modules anymore, you can edit your
`webpack.config.js`'s `CSS_LOADERS` to look something like:

```js
const CSS_LOADER = combineLoaders([
    {
        loader: 'css',
        query: {
            modules: true,
            importLoaders: 2, // 2 for the chained postcss-loader and sass-loader
            localIdentName: '[path]__[name]__[local]_[hash:base64:5]',
            sourceMap: true
        },
    },
    { loader: 'postcss' },
    {
        loader: 'sass',
        // ...
    },
    // ...
]);
```

Note the comments above on `importLoaders`: this value should always match the number of loaders
chained after the `css-loader` in order for imported files to be processed by the later loaders.

#### HTML generation

Using plugins, you can have Webpack generate the HTML file that will render your app -- allowing you
to avoid hard coding the inclusion of any built files. We've had success with [html-webpack-plugin](https://github.com/ampedandwired/html-webpack-plugin).

If you do this, you may also be interested in setting a more appropriate [`output.publicPath`] in your
Webpack configuration, as well as modifying the default `publicPath` that's set by the [demo server](./server.demo.js#L27).

#### Assets

##### SVGs

There are a number of ways to load SVGs, but we've had success with loading them as React components
that we can manipulate.

Install [svg-react-loader](https://github.com/boopathi/react-svg-loader) and
[image-webpack-loader](https://github.com/tcoopman/image-webpack-loader):

```bash
npm install -D react-svg-loader image-webpack-loader
```

Add a SVG loader configuration to your Webpack configuration:

```js
const SVG_LOADER = combineLoaders([
    { loader: 'babel' },
    { loader: 'svg-react' },
    // Can't supply the query using the query object as json formats aren't supported
    { loader: 'image-webpack?{ svgo: { plugins: [{ removeTitle: true }, { cleanupIDs: false }] } }' },
]);
```

And add the SVG loader to your Webpack configuration:

```js
module: {
    loaders: [
        {
            test: /\.svg$/,
            exclude: [PATHS.NODE_MODULES],
            loader: SVG_LOADER
        },
        // ...
    ],
    // ...
}
```

##### Images

Install [image-webpack-loader](https://github.com/tcoopman/image-webpack-loader) and
[url-loader](https://github.com/webpack/url-loader):

```bash
npm install -D file-loader url-loader image-webpack-loader
```

Add an image loader configuration to your Webpack configuration:

```js
// Define a PNG loader that will be inlined as a Data Url if it's under 100kb
const PNG_LOADER = combineLoaders([
    {
        loader: 'url',
        query: {
            limit: 100000
            mimetype: 'image/png',
        },
    },
    // Can't supply the query using the query object as json formats aren't supported
    // NOTE: These are super awesome optimization levels, you should dial them down if the build is slow
    { loader: 'image-webpack?{ optimizationLevel: 7, pngquant: { quality: "65-90", speed: 1 } }' },
]);
```

And add the image loader to your Webpack configuration:

```js
module: {
    loaders: [
        {
            test: /\.png$/,
            exclude: [PATHS.NODE_MODULES],
            loader: PNG_LOADER
        },
        // ...
    ],
    // ...
}
```

[See the image-webpack-loader docs](https://github.com/tcoopman/image-webpack-loader#usage)
to see how to define loaders for other formats as well as control their qualities.

#### Bootstrap

Our preferred way of loading Bootstrap is to use [bootstrap-loader](https://github.com/shakacode/bootstrap-loader)
so that bootstrap can be safely loaded into the global scope without more configuration when using
CSS Modules.

Install it, with [bootstrap-sass](https://github.com/twbs/bootstrap-sass):

```bash
npm install -D bootstrap-loader
npm install -S bootstrap-sass
```

Create a `.bootstraprc`:

```yaml
---
bootstrapVersion: 3

# Make sure to load bootstrap through Sass and Autoprefixer
styleLoaders:
    - style
    - css?sourceMap
    - postcss
    - sass?sourceMap&output=expanded&precision=8

styles:
    # Always needs to be included
    mixins: true

    # Any other stylesheets you'd like
```

And add it to your Webpack config and demo server's entry:

```js
// webpack.config.js
const config = {
    entry: [
        PRODUCTION || EXTRACT ? 'bootstrap-loader/extractStyles' : 'bootstrap-loader',
        PATHS.APP,
    ],
    // ...
}

// server.demo.js
config.entry = ['bootstrap-loader', path.resolve(__dirname, 'demo/app')];
```

See the [usage](https://github.com/shakacode/bootstrap-loader#usage) and
[configuration](https://github.com/shakacode/bootstrap-loader#common-options-for-bootstrap-3-and-4)
docs for more information.

#### Developing with npm link

Due to the way `npm link` works, it can cause your bundles to have duplications (for example, if
both your project and the `link`ed library use React, it'll be included twice). Add aliases using
[config.resolve.alias](https://webpack.github.io/docs/configuration.html#resolve-alias) to have all
imports matching the alias to resolve to the path you specify.

This is especially important if you plan to keep the `link`s for publishing, but useful while
developing to make builds faster.

#### Developing libraries

Although this boilerplate wasn't set up with library creation in mind, much of it can still be
recycled if you're developing something reusable across multiple projects. While there are no hard
rules, there are typically a few nice-to-haves in terms of generated outputs:

* A transpiled version - *for older build systems*
* A transpiled version with ES6 import syntax - *for newer build systems that understand the import
  syntax*
* A minified bundle, in UMD format - *for drop-in script tags and initial ease of use*

**Note**: Users will always have the option to directly include your un-built version if they use a
module bundler and configure it to build your package properly. Whenever possible, this should be
the recommended approach as it gives users full control over what they import.

The rest of this section will assume you want to generate all three of these outputs.

##### Normal transpiled version:

First, replace `es2015` from the top-level `presets` value in your `.babelrc` with
`es2015-no-commonjs` (making sure to install `babel-preset-es2015-no-commonjs`; this isn't strictly
necessary here, but it does make generating the ES6 version much easier in terms of configuration),
so your configuration should now look something like this:

```js
{
    ...
    'presets': ['react', 'es2015-no-commonjs'], // use es2015-no-commonjs instead of es2015
    ...
}
```

Remove the `transform-runtime` plugin from the top-level `plugins` value, as each of the files in
the unbundled version should be self contained (otherwise, using `transform-runtime` will leave
imports to `babel-runtime` in the transpiled version, forcing the user to also use `babel-runtime`).

Then, set up a new environment in your `.babelrc` (making sure to install
`babel-plugin-transform-es2015-modules-commonjs`, which adds back the CommonJS transformation to
this environment), like so:

```js
{
    ...
    'env': {
        ...
        'cjs': {
            'plugins': ['transform-es2015-modules-commonjs']
        },
        ...
    },
    ...
}
```

And finally, add the build script to your `package.json` (replacing `./lib` with your code
directory):

```bash
cross-env BABEL_ENV=cjs babel ./lib -d cjs
```

Which will transpile the javascript files in `lib/` into `cjs/` using the `cjs` babel environment
you just set up.

##### ES6 transpiled version:

Following from above, because you've switched to using `babel-preset-es2015-no-commonjs`,
generating the ES6 version doesn't require any further configuration and can be done using just:

```bash
babel ./lib -d es6
```

##### Bundled version:

This version relies on using webpack to bundle everything together into a single file, similar to
how the boilerplate is set up initially. You should be careful about including everything, making
sure that the necessary polyfills (through `babel-runtime`, not `babel-polyfill`!) are bundled as
you can't assume anything about the user's environment if they just drop the bundled script into a
script tag.

Again, set up a new babel environment that will re-add the `transform-runtime` plugin (since we
can now bundle the `babel-runtime` dependencies in):

```js
{
    ...
    'env': {
        ...
        'bundle': {
            'plugins': [
                ['transform-runtime', {
                    'polyfill': true
                } ]
            ]
        },
        ...
    },
    ...
}
```

**Note**: Make sure `babel-runtime` is installed as a devDependency!

Now you'll need to change a few things in your webpack configuration. Assuming your entry point and
output paths are OK, you should add a few things to `config.output` to let webpack know you want a
library:

```js
const config = {
    ...
    output: {
        ...,
        library: 'your-library-name',
        libraryTarget: 'umd',
        ...
    },
    ...
}
```

And assuming you don't want to bundle React and other shared
[peer-dependencies](https://nodejs.org/en/blog/npm/peer-dependencies/), move `react`, `react-dom`,
and etc to be dev and peer dependencies in your `package.json` and add an `externals` pattern
to `config` to tell webpack to avoid adding these packages in the final bundle:

```js
const config = {
    ...
    externals: PRODUCTION ? [/^react(-dom|-addons.*)?$/] : null,
    ...
}
```

Finally, the build script is just:

```bash
cross-env NODE_ENV=production BABEL_ENV=bundle webpack -p
```

Note the use of `NODE_ENV=production` here since the bundled package will usually be used without a
module bundler and therefore needs to have any development checks dependent on `NODE_ENV` be
stripped away before usage.

##### What about other assets?

If you have scss, css, or other assets, it's best to process them into directly usable forms (ie.
already preprocessed css, optimized assets) and then output them into either a single directory or
with each output separately. If your javascript directly requires some of these assets, for example
a component requiring its own stylesheet, you'll probably want to structure the built assets in a
similar fashion as the pre-built assets.

##### What about building for node?

Oh boy.

Well, for the most part, your CommonJS export should be enough unless you are using any
browser-specific APIs (ie. the DOM, browser globals, etc). Node users should never have to import
from your bundled version and should just use your package's default CommonJS export.

However, if you are building something that uses browser-specific APIs but would like to strip those
away depending on the target, then you'll probably want to specify what you'd like to include by
using different root entry points for each target. Remember to set your `package.json`'s `main`
field to point to your built node output, and the `browser` field to point to the web output to let
the user's module bundler pick the right version accordingly.

**Note**: If you'd like to support Node's import convention of allowing a single export to be
immediately usable by an importer, ie. `var foo = require('foo')()` where `foo` exports a single
function, you'll need to add `babel-plugin-add-module-exports` to your `.babelrc`'s CommonJS build
(before the `transform-es2015-modules-commonjs`). If you've been following this document, your
`.bablerc`'s `cjs` entry should then look like:

```js
{
    ...
    'env': {
        ...
        'cjs': {
            'plugins': [
                'add-module-exports',
                'transform-es2015-modules-commonjs'
            ]
        },
        ...
    },
    ...
}
```

As a final touch, you may also want to change your webpack configuration to have `target: 'node'`
(if you have multiple targets, you can pass back an array of configurations each with their own
target, ie. web and node, and output location). This seems to cause build errors for some packages
though, so your leverage with this may vary; usually just telling Node users to use your CommonJS
export is enough.

##### Publishing to NPM

If you've set up your `package.json` with [your own settings](#additional-setup), you're mostly good
to go. There's just a few settings left to include in there:

* [main](https://docs.npmjs.com/files/package.json#main) - Your main, CommonJS, export. If you've
  been following this section, this will be `lib/index.js`.
* [jsnext:main](https://github.com/rollup/rollup/wiki/jsnext:main) - Your ES6 export. If you've been
  following this section, this will be `es6/index.js`. Note that this isn't official in terms of NPM
  yet, but most modern module bundlers already accept this field or can be configured to.
* [files](https://docs.npmjs.com/files/package.json#files) - Files to be included for NPM. Make sure
  to include the folders that hold your built versions; if you've been following this section,
  you'll want to include `bundle`, `es6`, and `lib`.
* [directories](https://docs.npmjs.com/files/package.json#directories) - Package directories; the
  most important one here is the `lib` entry, which, if you've been following this section, will be
  `lib/`.
* [keywords](https://docs.npmjs.com/files/package.json#keywords) - Keywords to find your package on
  NPM. You're probably the expert here ;).

Good to Know
------------

At the moment, we're using the newest Webpack beta (2.1.0-beta.17) because [Webpack 2 comes with a
lot of great features](https://gist.github.com/sokra/27b24881210b56bbaff7), especially
tree-shaking. Although it's in beta, we've been using it for a while and have had no stability
issues. Although there are some package warnings, most 1.x plugins and loaders will work seamlessly
with no changes required (*read as: we have yet to encounter any plugin requiring more than just a
version bump on their webpack peer-dependency to support Webpack 2, aside from the 1.x extract-text
plugin on webpack 2.1.0-beta.16+*). Just make sure to use the most recent plugin version.

We include our own ESLint config, based off our [Javascript Styleguide](https://github.com/ascribe/javascript),
which is itself based off of the [Airbnb Javascript Styleguide](https://github.com/airbnb/javascript).
If you find you don't like the settings, you can change them through the [.eslintrc.json config](./.eslintrc.json).

There are a TON of [plugins](https://webpack.github.io/docs/list-of-plugins.html) and
[loaders](https://webpack.github.io/docs/list-of-loaders.html), so go exploring!


Yet Another React Boilerplate???
--------------------------------

Yep.

But before you go back to your [boilerplate-finder](http://andrewhfarmer.com/starter-project/) and
pick out [the most complicated boilerplate of all time](https://github.com/davezuko/react-redux-starter-kit)
(just joking; you should check it out as a resource for things to include on top / later), think
about all the effort you'll spend either understanding everything in that boilerplate or, perhaps
more anti-climatically, ripping out the features you don't need.

We built this because we like starting small and simple; we like understanding our tools and why we
use them. And also because we make tons of demos.


Acknowledgements
----------------

Special thanks to the BigchainDB/ascribe.io team for their insights and code contributions:

@diminator, @r-marques, @vrde, @ttmc, @rhsimplex, @sbellem, @TimDaub
