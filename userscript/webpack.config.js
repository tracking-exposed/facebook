/* eslint-disable strict, no-console, object-shorthand */
/* eslint-disable import/no-extraneous-dependencies, import/newline-after-import */
'use strict';

const path = require('path');

const webpack = require('webpack');
const autoPrefixer = require('autoprefixer');
const combineLoaders = require('webpack-combine-loaders');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

require('dotenv').load({ silent: true });

const packageJSON = require('./package.json');
const NODE_ENV = process.env.NODE_ENV || 'development';
const PRODUCTION = NODE_ENV === 'production';
const DEVELOPMENT = NODE_ENV === 'development';
const BUILD = require('child_process').execSync('git rev-parse HEAD').toString().trim()


const PATHS = {
    APP: path.resolve(__dirname, 'src/app.js'),
    BUILD: path.resolve(__dirname, 'build'),
    DIST: path.resolve(__dirname, 'dist'),
    NODE_MODULES: path.resolve(__dirname, 'node_modules'),
};

/** EXTERNAL DEFINITIONS INJECTED INTO APP **/
const DEFINITIONS = {
    'process.env': {
        NODE_ENV: JSON.stringify(NODE_ENV),
        API_ROOT: JSON.stringify(NODE_ENV === 'development' ? 'http://localhost:8000/' : 'https://facebook.tracking.exposed/'),
        VERSION: JSON.stringify(packageJSON.version + (DEVELOPMENT ? '-dev' : '')),
        BUILD: JSON.stringify(BUILD),
        FLUSH_INTERVAL: JSON.stringify(DEVELOPMENT ? 10000 : 60000)
    },
};


/** PLUGINS **/
const PLUGINS = [
    new webpack.DefinePlugin(DEFINITIONS),
    new webpack.NoErrorsPlugin(),

    // Add additional base plugins
];

const PROD_PLUGINS = [
    new webpack.optimize.UglifyJsPlugin({
        compress: {
            screw_ie8: true,
            warnings: false
        },
        output: {
            comments: false
        },
        sourceMap: true
    }),
    new webpack.LoaderOptionsPlugin({
        debug: false,
        minimize: true
    }),

    // Add additional production plugins
];

const EXTRACT_CSS_PLUGIN = new ExtractTextPlugin(
    PRODUCTION ? 'styles.min.css' : 'styles.css', {
        allChunks: true
    }
);

PLUGINS.push(EXTRACT_CSS_PLUGIN);

if (PRODUCTION) {
    PLUGINS.push(...PROD_PLUGINS);
}

/** LOADERS **/
const JS_LOADER = combineLoaders([
    {
        loader: 'babel',
        query: {
            cacheDirectory: true,
        },
    },

    // Add additional JS loaders
]);

const CSS_LOADER = combineLoaders([
    {
        loader: 'css',
        query: {
            sourceMap: true
        }
    },

    { loader: 'postcss' },

    {
        loader: 'sass',
        query: {
            precision: '8', // If you use bootstrap, must be >= 8. See https://github.com/twbs/bootstrap-sass#sass-number-precision
            outputStyle: 'expanded',
            sourceMap: true
        },
    },

    // Add additional style / CSS loaders
]);

// Add additional loaders to handle other formats (ie. images, svg)

const LOADERS = [
    {
        test: /\.jsx?$/,
        exclude: [PATHS.NODE_MODULES],
        loader: JS_LOADER,
    },
    {
        test: /\.s[ac]ss$/,
        exclude: [PATHS.NODE_MODULES],
        loader: ExtractTextPlugin.extract('style', CSS_LOADER)
    },

    // Add additional loader specifications
];


/** EXPORTED WEBPACK CONFIG **/
const config = {
    entry: [PATHS.APP],

    output: {
        filename: PRODUCTION ? 'bundle.min.js' : 'bundle.js',
        path: PRODUCTION ? PATHS.DIST : PATHS.BUILD,
    },

    debug: !PRODUCTION,

    devtool: PRODUCTION ? '#source-map' : '#inline-source-map',

    target: 'web',

    resolve: {
        extensions: ['', '.js', '.jsx'],
        modules: ['node_modules'], // Don't use absolute path here to allow recursive matching
    },

    plugins: PLUGINS,

    module: {
        loaders: LOADERS,
    },

    postcss: [autoPrefixer()],
};

module.exports = config;
