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

var SPAM = "Personalisation Algorithm are a collective issue, and only collectively they can be addressed; today I am joining https://facebook.tracking.exposed and this technical message is necessary to link my user to this key: ";

var M = "link my user to this key: ";

function validateKey(req) {
    var postId = _.parseInt(req.params.postId);
    debug("This is the postId where we expect to find a key %d", postId);
    return request
        .getAsync({
            'url': 'https://www.facebook.com/' + postId,
            'headers': {
                'User-Agent': "User-Agent: curl/7.47.0"
            }
        })
        .then(function(page) {
            debugger;
            var mndx = page.body.indexOf(M);
            if(_.eq(mndx, -1)) {
                return utils
                    .shmFileWrite('MatchError', page.body)
                    .return({ 'json': { "results": "Error",
                                        "reason": "match not found" }});
            }
            else {
                debug("Match successful, procedding with NaCl import");
                var key = page.body
                            .substring(mndx, mndx + 200)
                            .replace(/<.*/, '')
                            .replace(/.*key:\ /, '');
                console.log("Key extracted %s", key);
                // https://www.npmjs.com/package/tweetnacl
            }
        })
        .catch(function(a, b) {
            console.log("Something went bad");
            console.log(typeof a);
            console.log(typeof b);
            return { 'json': { "results": "Error",
                               "reason": "page.body ∉ expectation" }};

        });
};

module.exports = {
    validateKey: validateKey
};
