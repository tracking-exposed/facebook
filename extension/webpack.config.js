/* eslint-disable strict, no-console, object-shorthand */
/* eslint-disable import/no-extraneous-dependencies, import/newline-after-import */
'use strict';

const path = require('path');
const exec = require('child_process').exec;

const webpack = require('webpack');
const autoPrefixer = require('autoprefixer');
const combineLoaders = require('webpack-combine-loaders');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const WebpackOnBuildPlugin = require('on-build-webpack');


require('dotenv').load({ silent: true });

const LAST_VERSION = 3;
const packageJSON = require('./package.json');
const NODE_ENV = process.env.NODE_ENV || 'development';
const PRODUCTION = NODE_ENV === 'production';
const DEVELOPMENT = NODE_ENV === 'development';
const BUILD = require('child_process').execSync('git rev-parse HEAD').toString().trim()


const PATHS = {
    APPS: {app: path.resolve(__dirname, 'src/app.js'),
           sync: path.resolve(__dirname, 'src/pages/sync.js')},
    BUILD: path.resolve(__dirname, 'build'),
    DIST: path.resolve(__dirname, 'dist'),
    NODE_MODULES: path.resolve(__dirname, 'node_modules'),
};

/** EXTERNAL DEFINITIONS INJECTED INTO APP **/
const DEFINITIONS = {
    'process.env': {
        NODE_ENV: JSON.stringify(NODE_ENV),
        API_ROOT: JSON.stringify((DEVELOPMENT ? 'http://localhost:8000/' : 'https://facebook.tracking.exposed/')+'v'+LAST_VERSION+'/'),
        VERSION: JSON.stringify(packageJSON.version + (DEVELOPMENT ? '-dev' : '')),
        BUILD: JSON.stringify(BUILD),
        FLUSH_INTERVAL: JSON.stringify(DEVELOPMENT ? 10000 : 60000)
    }
};

/** PLUGINS **/
const PLUGINS = [
    new webpack.DefinePlugin(DEFINITIONS),
    new webpack.NoErrorsPlugin()
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
    })

    // Add additional production plugins
];

const DEV_PLUGINS = [
    new WebpackOnBuildPlugin(function (stats) {
        const command = 'chromium-browser http://reload.extensions';
        exec(command);
    })
];

const EXTRACT_CSS_PLUGIN = new ExtractTextPlugin(
    PRODUCTION ? 'styles.min.css' : 'styles.css', {
        allChunks: true
    }
);

PLUGINS.push(EXTRACT_CSS_PLUGIN);

if (PRODUCTION) {
    PLUGINS.push(...PROD_PLUGINS);
} else if (DEVELOPMENT) {
    PLUGINS.push(...DEV_PLUGINS);
}

/** LOADERS **/
const JS_LOADER = combineLoaders([
    {
        loader: 'babel',
        query: {
            cacheDirectory: true
        }
    }

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
    entry: PATHS.APPS,

    output: {
        path: PRODUCTION ? PATHS.DIST : PATHS.BUILD,
        filename: PRODUCTION ? '[name].min.js' : '[name].js',
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
