var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('lib:personal');
var nconf = require('nconf');
 
var mongo = require('./mongo');
var utils = require('./utils');
var saveCSV = require('./saveCSV');

/* TO be moved in an utils file ? */
function getParam(req, what) {
    var rv = _.parseInt(_.get(req.params, what));
    if(_.isNaN(rv)) {
        debug("Invalid parameter here: [%s] %j", what, req.params);
        throw new Error("Invalid parameter");
    }
    return rv;
}

function mtByAmount(req) {

    var amount = getParam(req, 'amount');
    var skip = getParam(req, 'skip');
    var userId = getParam(req, 'userId');

    debug("%s htmls for user %d skip %d amount %d",
        req.randomUnicode, userId, skip, amount);

    return mongo
        .readLimit( nconf.get('schema').htmls,
            { userId: userId },
            { savingTime: -1 }, amount, skip)
        .map(function(element) {
            return _.omit(element, ['html', '_id']);
        })
        .then(function(retv) {
            debug("%s html requests returns %d units",
                req.randomUnicode, _.size(retv));
            return { 'json': retv };
        });
}

function mtByTime(req) {

    var userId = getParam(req, 'userId');
    var days = getParam(req, 'days');

    var begin = new Date(moment().subtract(days, 'd'));
    var LIMIT = 300;

    debug("%s metadata for user %d since %s (%d days ago) limit %d",
        req.randomUnicode, userId, begin, days, LIMIT);

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
}

function profile(req) {
    var numId = getParam(req, 'userId');

    return mongo
        .read( nconf.get('schema').supporters, { userId: numId })
        .map(function(element) {
            return _.omit(element, ['userSecret', '_id']);
        })
        .then(function(retv) {
            return { 'json': retv };
        });
}

function csv(req) {
    var skip = 0;
    var amount = 30000;
    var numId = getParam(req, 'userId');

    var forced = req.params.kind  === "feed" ? "feed" : "promoted";

    return saveCSV({
            userId: numId,
            postId: { "$exists": true },
            type: forced,
            savingTime: { "$gt": new Date(moment().subtract(30, 'd').toISOString()) }
        }, forced, amount, skip)
        .then(function(csv) {
            if(_.size(csv) == amount)
                debug("csv has been cut down the the limit: %d", _.size(csv));
            else
                debug("csv long %d entries", _.size(csv));

            return {
                headers: { "Content-Type": "csv/text",
                           "content-disposition":
                               "attachment; filename=\"" + forced + "-" + numId + ".csv\""
                },
                text: csv
            };
        });
};


module.exports = {
    mtByTime: mtByTime,
    mtByAmount: mtByAmount,
    profile: profile,
    csv: csv
};
