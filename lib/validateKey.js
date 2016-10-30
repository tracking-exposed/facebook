var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));
var debug = require('debug')('validate');
var os = require('os');
var nconf = require('nconf');
 
var mongo = require('./mongo');
var utils = require('./utils');
var error = require('./error');

function validateKey(req) {
    var postId = _.parseInt(req.params.postId);
    debug("This is the postId where we expect to find a key %d", postId);
    return request
        .getAsync('https://www.facebook.com/' + postId)
        .then(function(page) {
            debugger;
            console.log(page);
            return { 'text' : page };
        });
};

module.exports = {
    validateKey: validateKey
};
