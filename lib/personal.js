var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('lib:personal');
var nconf = require('nconf');
 
var mongo = require('./mongo');
var utils = require('./utils');
var saveCSV = require('./saveCSV');
var params = require('./params');
var alarms = require('./alarms');


/* 
 * this file implement the functionalities available to an user with a valid userToken,
 * the API are documented on:
 *      https://github.com/tracking-exposed/facebook/wiki/Personal-API-documentation
 */

function mtByAmount(req) {

    var amount = params.getInt(req, 'amount');
    var skip = params.getInt(req, 'skip');
    var userToken = params.getString(req, 'userToken');

    debug("%s htmls for user %d skip %d amount %d",
        req.randomUnicode, userToken, skip, amount);

    return validateToken(userToken)
        .then(function(userId) {
            return mongo
                .readLimit( nconf.get('schema').htmls,
                    { userId: userId},
                    { savingTime: -1 }, amount, skip)
                .map(function(element) {
                    return _.omit(element, ['html', '_id']);
                })
                .then(function(retv) {
                    debug("%s html requests returns %d units",
                        req.randomUnicode, _.size(retv));
                    return { 'json': retv };
                });
        });
}

function mtByTime(req) {

    var userToken = params.getString(req, 'userToken');
    var days = params.getInt(req, 'days');
    var begin = new Date(moment().subtract(days, 'd'));

    var LIMIT = 5000;

    debug("%s metadata for user %s since %s (%d days ago) limit %d",
        req.randomUnicode, userToken, begin, days, LIMIT);

    return validateToken(userToken)
        .then(function(userId) {
            return mongo
                .readLimit(nconf.get('schema').htmls, {
                    userId: userId,
                    savingTime: { "$gt": begin }},
                    { savingTime: -1 }, LIMIT, 0)
                .map(function(element) {
                    return _.omit(element, ['html', '_id']);
                })
                .then(function(retv) {
                    debug("%s metadata requests returns %d units (hardcoded limit %d)",
                        req.randomUnicode, _.size(retv), LIMIT);
                    return { 'json': retv };
                });

        });

}

function validateToken(userToken) {

    return mongo
        .read(nconf.get('schema').supporters, {
            userSecret: userToken
        })
        .tap(function(user) {
            if(_.size(user) !== 1)
                debug("userToken invalid");
                return alarms.reportAlarm({
                    caller: 'personal',
                    what: "invalid token?",
                    info: user
                })
        })
        .then(function(user) {
            debug("userToken is valid");
            return _.first(user).userId;
        });
}

/* this function is not yet used, it is for a section in which the user can 
 * customize/change the token or something else ?  */
function profile(req) {
    var numId = params.getString(req, 'userToken');

    return mongo
        .read( nconf.get('schema').supporters, { userToken: numId })
        .map(function(element) {
            return _.omit(element, ['userSecret', '_id']);
        })
        .then(function(retv) {
            return { 'json': retv };
        });
}

function csv(req) {
    var reqType = req.params.kind  === "feed" ? "feed" : "promoted";
    var startSince = moment().subtract(30, 'd').toISOString();
    var userToken = params.getString(req, 'userToken');
    var outputFilename = '"' + _.join([
        utils.string2Food(userToken),
        reqType,
        startSince
    ], '-') + '.csv"';

    debug("Has been requested %s CSV (%s)", reqType, outputFilename);

    return validateToken(userToken)
        .then(function(userId) {
            var skip = 0;
            var amount = 5000;

            return saveCSV({
                    userId: userId,
                    type: reqType,
                    savingTime: { "$gt": new Date(startSince) }
                }, reqType, amount, skip)
                .catch(function(error) {
                    debug("Unable to return CSV %s for user %s: %s", reqType, userId, error);
                    return null;
                });
        })
        .then(function(csv) {
            if(!csv || !_.size(csv)) {
                debug("no CSV content to be give back");
                return {
                    headers: { "Content-Type": "csv/text",
                               "content-disposition": "attachment; filename=\"error.csv\""
                    },
                    text: "There was an technical error in creating your CSV. Sorry for that. " +
                            "If the error persist, please notify to us at support@tracking.exposed, and we will investigate manually"
                }
            }
            debug("csv long %d entries", _.size(csv));

            return {
                headers: { "Content-Type": "csv/text",
                           "content-disposition":
                               "attachment; filename=" + outputFilename
                },
                text: csv
            };
        });
};

/* implementation of the new two graph if they can be made in time */
function dietBasic(req) {
    var userToken = params.getString(req, 'userToken');
    var days = params.getInt(req, 'days');
    var begin = new Date(moment().subtract(days, 'd'));
    var LIMIT = 4000;
    var fields = ['savingTime', 'publicationUTime', 'postId', 'hrefType', 'externalHref', 'permaLink', 'source', 'text', 'id'];

    debug("insist ~ user %s since %s (%d days ago) limit %d",
        userToken, begin, days, LIMIT);

    return validateToken(userToken)
        .then(function(userId) {
            return mongo
                .readLimit(nconf.get('schema').htmls, {
                        userId: userId,
                        savingTime: { "$gt": begin }, type: 'feed' 
                    }, { savingTime: -1 }, LIMIT, 0)
                .map(function(element) {
                    element.publicationUTime = moment(element.publicationUTime * 1000);
                    return _.pick(element, fields);
                })
                .then(function(x) {
                    debugger;
                    return { json: {
                            byPostId: _.countBy(x, 'postId'),
                            bySource: _.countBy(x, 'source'),
                            info: x
                        }
                    };
                });
    });
}

module.exports = {
    mtByTime: mtByTime,
    mtByAmount: mtByAmount,
    profile: profile,
    csv: csv,
    dietBasic: dietBasic
};
