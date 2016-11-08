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
    debug("optimize import here, take userId do cross check");
    var permalink = req.body.permalink;
    var publicKey = req.body.publicKey;
    console.log(JSON.stringify(req.body, undefined, 2));

    console.log("Looking for publicKey %s in %s", publicKey, permalink);
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
                    .return({ 'json': { "results": "Error",
                                        "reason": "match not found" }});
            }
            else {
                var $ = cheerio.load(page.body);
                var startUrl = page.body.indexOf("https://www.facebook.com/people/");
                var endUrl = page.body.indexOf('"', startUrl);
                var url = page.body.slice(startUrl, endUrl);
                var userId = url.split('?')[0].split('/').pop();

                // TODO CHECK is the same from API, TODO parseInt
                // Write in the Database the userId and its publicKey
                mongo.writeOne(nconf.get('schema').supporters, {
                    userId: userId,
                    publicKey: publicKey,
                    keyTime: new Date(),
                    lastInfo: new Date()
                });

                console.log("Connecting public key %s with user %s", publicKey, userId);
                return { "json": { "result": "success" } };
            }
        })
        .catch(function(a, b) {
            console.log("Something went bad");
            console.log(a);
            console.log(b);
            return { 'json': { "results": "Error",
                               "reason": "page.body ∉ expectation" }};

        });
};

module.exports = {
    validateKey: validateKey
};
