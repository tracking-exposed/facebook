const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');
const debug = require('debug')('lib:summary');
const pug = require('pug');
const nconf = require('nconf');

const mongo = require('./mongo');
const utils = require('./utils');
const opendata = require('./opendata');
const adopters = require('./adopters');

const MAXOBJS = 200;
function page(req) {
 
    return adopters
        .validateToken(req.params.userToken)
        .tap(function(supporter) {
            if(!supporter)
                throw new Error("authentication fail");
        })
        .then(function(supporter) {
            debug("Composing summary page for supporter %s", supporter.pseudo);
            return mongo
                .readLimit(nconf.get('schema').summary, { user: supporter.pseudo }, { impressionTime: -1}, 200, 0)
                .then(function(summary) {
                    debug("retrv here, %d", _.size(summary));
                    return {
                        summary,
                        supporter,
                    };
                });
        })
        .then(function(data) {
            // TODO echoes
            debug("Data here, %d %d", _.size(data.summary), _.size(data.supporter));
            return { 
                'text': pug.compileFile( __dirname + '/../sections/personal/summary.pug', {
                    pretty: true,
                    debug: false
                })({
                    supporter: data.supporter,
                    summary: data.summary
                })
            };
        })
        .catch(function(e) {
            debug("Error triggered");
            console.error(e);
            return {
                'text': 'Authentication Error!'
            };
        });

};

function data(req) {
    debug("not yet implemented");
    return { 'json': false };
};


/*
function mtByAmount(req) {

    var amount = params.getInt(req, 'amount');
    var skip = params.getInt(req, 'skip');
    var userToken = params.getString(req, 'userToken');

    debug("%s htmls for user %d skip %d amount %d",
        req.randomUnicode, userToken, skip, amount);

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
                        savingTime: { "$gt": begin }
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

function legacy(req) {
    var amount = params.getInt(req, 'amount');
    var userToken = params.getString(req, 'userToken');
    var fields = ['savingTime', 'publicationUTime', 'type', 'postId', 'hrefType', 'externalHref', 'permaLink', 'source', 'text', 'id'];
    var skip = params.getInt(req, 'skip', 0);

    return validateToken(userToken)
        .then(function(userId) {

            if(!userId)
                return { json: 'error' };

            debug("Validated userId, requested amount %d (skip %d)", amount, skip);

            return mongo
                .readLimit( nconf.get('schema').htmls,
                    { userId: _.parseInt(userId) },
                    { savingTime: -1 }, amount, skip)
                .map(function(element) {
                    element.publicationUTime = moment(element.publicationUTime * 1000);
                    return _.pick(element, fields);
                })
                .then(function(x) {
                    return { json: {
                            byPostId: _.countBy(x, 'postId'),
                            bySource: _.countBy(x, 'source'),
                            info: x
                        }
                    };
                });
        });
};

*/

module.exports = {
    page: page,
    data: data,
};


