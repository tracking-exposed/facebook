var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:selector');
var nconf = require('nconf');
 
var mongo = require('./mongo');

function getSelector(req) {
    /* the function selector is become part of an authentication process, it return the
     * personal secret from the supporter table. */
    debugger;
    debug("getSelector %s", req.headers['x-fbtrex-version']);
    return {
        'json': {
            // 'selector': '.fbUserStory',
            'selector': '.userContentWrapper',
        }
    };
};

module.exports = {
    getSelector: getSelector
};
