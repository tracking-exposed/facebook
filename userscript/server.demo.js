/* eslint-disable strict, no-console */
/* eslint-disable import/no-extraneous-dependencies, import/newline-after-import */
'use strict';
const path = require('path');

const WebpackDevServer = require('webpack-dev-server');
const webpack = require('webpack');
const config = require('./webpack.config.js');

require('dotenv').load({ silent: true });

const HOST_NAME = process.env.DEMO_HOST_NAME || 'localhost';
const PORT = process.env.DEMO_PORT || 3000;

// Manipulate webpack entry for demo server; only use demo app
config.entry = [path.resolve(__dirname, 'demo/app')];

// Enable hot reloading if on demo mode
if (process.env.NODE_ENV === 'demo') {
    config.entry.unshift(`webpack-dev-server/client?http://${HOST_NAME}:${PORT}/`,
                         'webpack/hot/dev-server');
    config.plugins.push(new webpack.HotModuleReplacementPlugin());
    // React hot reloading is enabled through .babelrc and babel-react-transform
}

// Specify output location for bundled files
config.output.publicPath = '/assets/';

// Configure server
const compiler = webpack(config);

const server = new WebpackDevServer(compiler, {
    publicPath: config.output.publicPath,
    contentBase: './demo',
    historyApiFallback: {
        index: '/'
    },
    hot: true,
    noInfo: false,
    stats: { colors: true }
});

// Start server
server.listen(PORT, HOST_NAME, (err) => {
    if (err) {
        console.error(`Demo server ran into ${err} while starting on ${HOST_NAME}:${PORT}. ` +
                      'Shutting down...');
        server.close();
    }
    console.log(`Demo server running on ${HOST_NAME}:${PORT}`);
});
