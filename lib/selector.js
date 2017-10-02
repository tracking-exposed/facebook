var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:selector');
var nconf = require('nconf');
 
var mongo = require('./mongo');

function getSelector(req) {
    debug("getSelector %s", req.headers['x-fbtrex-version']);
    return {
        'json': {
            'selector': '.fbUserStory',
        }
    };
};

module.exports = {
    getSelector: getSelector
};
