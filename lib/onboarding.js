var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));
var debug = require('debug')('onboarding');
var os = require('os');
var nconf = require('nconf');
var fs = require('fs');

var mongo = require('./mongo');
var utils = require('./utils');

function validateKey(req) {
    debugger;
    var permalink = req.body.permalink;
    var publicKey = req.body.publicKey;
    var declaredSupId = _.parseInt(req.body.supporterId);

    debug("Looking for publicKey %s of %d in %s",
        publicKey, declaredSupId, permalink);

    return request
        .getAsync({
            'url': permalink,
            'headers': {
                'User-Agent': "User-Agent: curl/7.47.0"
            }
        })
        .then(function(page) {
            var mndx = page.body.indexOf(publicKey);
            if(mndx === -1) {
                return utils
                    .shmFileWrite('MatchError', page.body)
                    .then(function() {
                        throw new Error("MatchError");
                    });
            }
            else {
                var startUrl = page.body.indexOf("https://www.facebook.com/people/");
                var endUrl = page.body.indexOf('"', startUrl);
                var url = page.body.slice(startUrl, endUrl);
                var userId = url.split('?')[0].split('/').pop();
                var userSecret = _.random(0, 0xffffff);

                if(_.parseInt(userId) !== declaredSupId) {
                    debug("consinstency error %d != %d, validation fail",
                        _.parseInt(userId), declaredSupId);
                    throw new Error("Inconsistency");
                }

                console.log("Connecting public key %s with user %s",
                    publicKey, userId);

                return mongo.writeOne(nconf.get('schema').supporters, {
                    userId: declaredSupId,
                    publicKey: publicKey,
                    userSecret: userSecret,
                    keyTime: new Date(),
                    lastInfo: new Date()
                })
                .return({ "json": { 
                    "result": "OK",
                    "userSecret": userSecret
                }});
            }
        })
        .catch(function(a, b) {
            console.error("facebook page retrive for validation: fail");
            console.error(a);
            console.error(b);
            return { 'json': {
                "result": "Error",
                "reason": "page.body ∉ expectation"
            }};

        })
        .then(function(retVal) {
            /* whatever return value need a CORS header */
            retVal.headers = {
                "Access-Control-Allow-Origin":
                "https://facebook.com"
            }
            return retVal;
        })
};

module.exports = {
    validateKey: validateKey
};
