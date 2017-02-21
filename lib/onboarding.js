var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('lib:onboarding');
var os = require('os');
var nconf = require('nconf');

var mongo = require('./mongo');
var utils = require('./utils');
var alarms = require('./alarms');

function extract1(body) {
    var permaRef = body.indexOf("permalink");
    var beginId = body.indexOf(';id=', permaRef) + 4;
    var endId = body.indexOf('&', beginId);
    var parsedId = _.parseInt(body.slice(beginId, endId));
    debug("Extracting with pattern #1 (vanity name) %d", parsedId);
    return parsedId;
}

function extract2(body) {
    var beginP  = '\"actor_id\":';
    var endP = ',\"story';
    var beginId = body.indexOf(beginP) + _.size(beginP);
    var endId = body.indexOf(endP, beginId);
    var parsedId = _.parseInt(body.slice(beginId, endId));
    debug("Extracting with pattern #2 (no vanity name) %d", parsedId);
    return parsedId;
}

function extract3(body) {
    var startStr = body.indexOf('ownerid');
    var dirtyStr = body.substring(startStr, startStr + 30);
    var numberStr = /[0-9].*"/.exec(dirtyStr);

    if(_.isUndefined(numberStr) || !numberStr[0] ) {
        debug("Fail regexp for [%s]", dirtyStr);
        return null;
    }

    var parsedId = _.parseInt(numberStr);
    debug("Extracting with pattern #3 (ownerId fallback) %d", parsedId);
    return parsedId;
}

function retrieveHTMLviaCurl(checkedURL) {
    return request
        .getAsync({
            'url': checkedURL,
            'headers': {
                'User-Agent': "User-Agent: curl/7.47.0"
            }
        })
        .then(function(page) {
            return page.body;
        });
}

/* ENV curlMock is used when you want re-process some HTML
 * that are raising parsing issues */
function retrieveHTMLviaFile(fname) {
    debug("curlMock set on file %s", fname);
    return fs
        .readFileAsync(fname, 'utf-8')
        .then(JSON.parse);
}

function validateKey(req) {
    var permalink = req.body.permalink;
    var publicKey = req.body.publicKey;
    var userId = _.parseInt(req.body.userId);
    var html = req.body.html;

    debug("Looking for publicKey %s of %d in %s, html %d",
        publicKey, userId, permalink, _.size(html) );

    if(_.some([permalink, publicKey, html], _.isNull))
        throw new Error("malformed request");

    var curlMock = nconf.get('curlMock');

    var bodyPromise = curlMock ?
        retrieveHTMLviaFile(curlMock) :
        retrieveHTMLviaCurl(permalink);

    return bodyPromise
        .then(function(body) {
            var mndx = body.indexOf(publicKey);
            if(mndx === -1) {
                return utils
                    .shmFileWrite('MatchError', body)
                    .then(function() {
                        throw new Error("key lookup");
                    });
            }
            else {

                var parsedId = extract1(body) || extract2(body) || extract3(body);

                if(parsedId !== userId) {
                    debug("consinstency error %d != %d, validation fail",
                        userId, parsedId);
                    return utils
                        .shmFileWrite('UserIdParseError-' + userId, JSON.stringify(body))
                        .then(function() {
                            throw new Error("userId parsing and double check");
                        });
                }

                debug("Acquired public key %s with user %d", publicKey, userId);
                return {
                    userId: userId,
                    publicKey: publicKey,
                };
            }
        })
        .tap(function(linked) {
            return mongo
                .read(nconf.get('schema').supporters, linked)
                .then(function(exists) {
                    debug("⭐ Testing if the users exists: %s",
                        JSON.stringify(exists, undefined, 2));
                    if(_.size(exists))
                        throw new Error("user Exists");
                })
        })
        .then(function(linked) {
            debug("Adding a new Supporter %s %d", linked.publicKey, linked.userId);
            return mongo
                .writeOne(nconf.get('schema').supporters, _.extend(linked, {
                    userSecret: _.random(0, 0xfffffff),
                    keyTime: new Date(moment().toISOString()),
                    lastActivity: new Date(moment().toISOString())
                }))
                .then(function(supporter) {
                    return {
                        'json': {
                            result: 'OK',
                            supporter: supporter
                        }
                    };
                });
        })
        .catch(function(error) {
            return alarms.reportAlarm({
                'caller': 'onboarding',
                'what': error,
                'info': req.body
            })
            .return({
                'json': {
                    result: 'error',
                    reason: error
                }
            });
        });
};

module.exports = {
    validateKey: validateKey
};
