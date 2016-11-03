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

var SPAM = "Personalisation Algorithm are a collective issue, and only collectively they can be addressed; today I am joining https://facebook.tracking.exposed and this technical message is necessary to link my user to this key: ";

var M = "link my user to this key: ";

function validateKey(req) {
    var permalink = req.body.permalink;
    var publicKey = req.body.publicKey;
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
                console.log("Match successful, procedding with NaCl import");
                var $ = cheerio.load(page.body);
                console.log("element loaded");
                var startUrl = page.body.indexOf("https://www.facebook.com/people/");
                var endUrl = page.body.indexOf('"', startUrl);
                var url = page.body.slice(startUrl, endUrl);
                console.log(url);
                var userId = url.split('?')[0].split('/').pop();
                console.log(userId);

                // Write in the Database the userId and its publicKey!

                /*
                 * For whatever reason this doesn't work :(
                var userId = $('.userContentWrapper').find('a[href^="https://www.facebook.com/people/"]')
                                 .attr('href')
                                 .split('?')[0]
                                 .split('/').pop();
                */
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
