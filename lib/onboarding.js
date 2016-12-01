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
    var permalink = req.body.permalink;
    var publicKey = req.body.publicKey;
    var userId = _.parseInt(req.body.userId);
    var html = req.body.html;

    debug("Looking for publicKey %s of %d in %s, html %d",
        publicKey, userId, permalink, _.size(html) );

    return utils
        .shmFileWrite('OnBoarding', JSON.stringify(req.body))
        .then(function() {
            if(!_.isNull(permalink))
                return permalink;

            debug("UNCOMMON FORMAT: The link to the post has to be parsed");
            /* Here can be managed different condition, if they arise */
            console.error("Warning: uncommon onboarding format spot at",
                moment().toISOString());
            throw new Error("Unable to complete onboarding");
        })
        .then(function(checkedURL) {
            debug("Starting request to %s emulating curl", checkedURL);
            return request
                .getAsync({
                    'url': checkedURL,
                    'headers': {
                        'User-Agent': "User-Agent: curl/7.47.0"
                    }
                })
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
                var permaRef = page.body.indexOf("permalink");
                var beginId = page.body.indexOf(';id=', permaRef) + 4;
                var endId = page.body.indexOf('&', beginId);
                var parsedId = page.body.slice(beginId, endId);
                var userSecret = _.random(0, 0xffffff);

                if(_.parseInt(parsedId) !== userId) {
                    debug("consinstency error %d != %d, validation fail",
                        userId, parsedId);
                    debug("startUrl %d endUrl %d url %s",
                        startUrl, endUrl, parsedId);
                    throw new Error("Inconsistency");
                }

                debug("Connecting public key %s with user %d (%d)",
                    publicKey, userId, userSecret);

                return mongo.writeOne(nconf.get('schema').supporters, {
                    userId: userId,
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
