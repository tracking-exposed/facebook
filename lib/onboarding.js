var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('onboarding');
var os = require('os');
var nconf = require('nconf');

var mongo = require('./mongo');
var utils = require('./utils');

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
    var dirtyStr = body.substring(startStr, startStr + 20);
    var parsedId = _.parseInt(/[0-9].*"/.exec(dirtyStr)[0])
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

function retrieveHTMLviaFile(fname) {
    debug("curlMock set on file %s", fname);
    return fs
        .readFileAsync(fname, 'utf-8')
        .then(JSON.parse);
}

function composError(errstr) {
    debug("failure! [%s]", errstr);
    return { 'json': { 'result': 'error', 'reason': errstr } };
};

function validateKey(req) {
    var permalink = req.body.permalink;
    var publicKey = req.body.publicKey;
    var userId = _.parseInt(req.body.userId);
    var html = req.body.html;

    debug("Looking for publicKey %s of %d in %s, html %d",
        publicKey, userId, permalink, _.size(html) );

    if(_.some[permalink, publicKey, html], _.isNull) {
        return composError("missing expected data");
    }

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
                        return composError("key lookup");
                    });
            }
            else {

                var parsedId = extract1(body) || extract2(body) | extract3(body);
                var userSecret = _.random(0, 0xffffff);

                if(parsedId !== userId) {
                    debug("consinstency error %d != %d, validation fail",
                        userId, parsedId);
                    return utils
                        .shmFileWrite('UserIdParseError-' + userId, JSON.stringify(body))
                        .then(function() {
                            return composError("userId parsing and double check");
                        });
                }

                debug("Connecting public key %s with user %d (%d)",
                    publicKey, userId, userSecret);

                return mongo.upsertOne(nconf.get('schema').supporters, {
                    userId: userId,
                },
                {
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
