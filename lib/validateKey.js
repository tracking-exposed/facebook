var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));
var debug = require('debug')('validate');
var os = require('os');
var nconf = require('nconf');
var cheerio = require('cheerio');
var fs = require('fs');

var mongo = require('./mongo');
var utils = require('./utils');
var error = require('./error');

function validateKey(req) {
    var permalink = req.body.permalink;
    var publicKey = req.body.publicKey;
    var declaredSupId = _.parseInt(req.body.supporterId);

    console.log("TODO sanitiy check " + JSON.stringify(permalink.split('/')));
    debug("Looking for publicKey %s of %d in %s",
        publicKey, declaredSupId,permalink);

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
                    .return({ 'json': { "result": "Error",
                                        "reason": "match not found" }});
            }
            else {
                var $ = cheerio.load(page.body);
                var startUrl = page.body.indexOf("https://www.facebook.com/people/");
                var endUrl = page.body.indexOf('"', startUrl);
                var url = page.body.slice(startUrl, endUrl);
                var userId = url.split('?')[0].split('/').pop();

                if(_.parseInt(userId) !== declaredSupId) {
                    debug("consinstency error %d != %d, validation fail",
                        _.parseInt(userId), declaredSupId);
                    return { "json": { "result": "Error",
                                       "reason": "inconsinstency" }};
                }

                console.log("Connecting public key %s with user %s", publicKey, userId);
                return mongo.writeOne(nconf.get('schema').supporters, {
                    userId: declaredSupId,
                    publicKey: publicKey,
                    keyTime: new Date(),
                    lastInfo: new Date()
                })
                .return({ "json": { "result": "success" }});
            }
        })
        .catch(function(a, b) {
            console.log("facebook page retrive for validation: fail");
            console.error(a);
            console.error(b);
            return { 'json': { "result": "Error",
                               "reason": "page.body ∉ expectation" }};

        });
};

module.exports = {
    validateKey: validateKey
};
