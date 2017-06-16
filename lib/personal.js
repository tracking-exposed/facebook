var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:personal');
var nconf = require('nconf');
 
var mongo = require('./mongo');
var utils = require('./utils');

/* TO be moved in an utils file ? */
function getParam(req, what) {
    var rv = _.parseInt(_.get(req.params, what));
    if(_.isNaN(rv)) {
        debug("Invalid parameter here: [%s] %j", what, params);
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
};

function mtByTime(req) {

    var userId = getParam(req, 'userId');
    var days = getParam(req, 'days');

    var begin = new Date(moment().subtract(days, 'd'))

    debug("%s metadata for user %d since %s (%d days ago)",
        req.randomUnicode, userId, begin, days);

    return mongo
        .readLimit(nconf.get('schema').htmls, {
            userId: userId,
            savingTime: { "$gt": begin }}, {}, 2600, 0)
        .map(function(element) {
            return _.omit(element, ['html', '_id']);
        })
        .then(function(retv) {
            debug("%s metadata requests returns %d units",
                req.randomUnicode, _.size(retv));
            return { 'json': retv };
        });
};

function profile(req) {
    req.params.skip = 0;
    req.params.amount = 0;
    pp = personalParm("profile", req.params);

    return mongo
        .read( nconf.get('schema').supporters, { userId: pp.numId })
        .map(function(element) {
            return _.omit(element, ['userSecret', '_id']);
        })
        .then(function(retv) {
            return { 'json': retv };
        });
};

function csv(req) {
    req.params.skip = 0;
    req.params.amount = 30000;

    var forced = req.params.kind  === "feed" ? "feed" : "promoted";

    if(forced === 'feed')
        var keys = [ 'savingTime', 'id', 'type', 'userId', 'impressionOrder',
                     'timelineId', 'publicationTime', 'postId', 'permaLink',
                     'hrefType', 'source', 'text', 'reason' ];
    else
        var keys = [ 'savingTime', 'id', 'type', 'userId', 'impressionOrder',
                     'timelineId', 'title',
                     'postLink', 'linkType', 'ownerName' ];

    return mongo
        .readLimit( nconf.get('schema').htmls, {
            userId: pp.numId,
            postId: { "$exists": true },
            type: forced,
            savingTime: { "$gt": new Date(moment().subtract(30, 'd').toISOString()) }
        }, { }, pp.amount, pp.skip)
        .map(function(element) {
            return _.omit(element, ['html', '_id']);
        })
        .then(function(htmls) {
            var userId = htmls[0].userId;
            var oldest = htmls[0].savingTime;

            return mongo.read( nconf.get('schema').impressions, {
                userId: userId,
                impressionTime: { "$gt": new Date(moment(oldest).subtract(1, 'd').toISOString()) }
            })
            .reduce(function(memo, impression) {
                _.set(memo, impression.htmlId, impression.impressionOrder);
                return memo;
            }, {})
            .then(function(impdict) {
                return _.map(htmls, function(h) {
                    h.impressionOrder = impdict[h.id];
                    return h;
                });
            });
        })
        .tap(function(a) {
            debug("csv, reduction in progress (cap %d) %d entry", pp.amount, _.size(a));
            if(_.size(a) === pp.amount)
                debug("Limit reached!?");
        })
        .reduce(function(memo, entry) {
            if(!memo.init) {
                memo.csv += _.trim(JSON.stringify(keys), "][") + "\n";
                memo.init = true;
            }
            entry.savingTime = moment(entry.savingTime).toISOString();
            /* TODO check `memo.onlyValue` directive */
            _.each(keys, function(k, i) {
                var swap;
                if(k === 'publicationTime') {
                    swap = _.get(entry, 'publicationUTime');
                    swap = moment(swap * 1000).toISOString();
                } else {
                    swap = _.get(entry, k, "");
                    swap = _.replace(swap, /\"/g, '〃');
                    swap = _.replace(swap, /\'/g, '’');
                }
                memo.csv +=  '"' + swap + '"';
                if(!_.eq(i, _.size(keys) - 1))
                    memo.csv += ',';
            });
            memo.csv += "\n";
            return memo;

        }, { init: false, onlyValues: false, csv: "" })
        .then(function(blob) {
            var t = blob.csv;
            debug("csv long %d entries", _.size(t));
            return {
                headers: { "Content-Type": "csv/text",
                           "content-disposition":
                               "attachment; filename=\"" + forced + "-" + pp.numId + ".csv\""
                },
                text: t
            };
        });
};


module.exports = {
    mtByTime: mtByTime,
    mtByAmount: mtByAmount,
    profile: profile,
    csv: csv
};
