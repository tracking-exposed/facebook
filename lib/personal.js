var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:personal');
var nconf = require('nconf');
 
var mongo = require('./mongo');
var utils = require('./utils');

/*
 * getTimelines take information from the impressions, to get more stats 
 */

function getTimelines(req) {
    var numId = _.parseInt(req.params.userId);

    if(_.every(numId), !_.isNaN)
        throw new Error("Invalid request");

    debug("%s getTimelines user %d", req.randomUnicode, numId);

    var mongoAggro = {
        _id : "$timelineId",
        impressions: { $sum: 1},
        timings: { $addToSet: '$impressionTime' }
    };

    var publicMatch = { userId: numId, visibility: 'public' };
    var publicCount = { _id : "$timelineId", visible: { $sum: 1}};

    return Promise.all([
        mongo.aggregate(nconf.get('schema').impressions, {
            userId: numId }, mongoAggro),
        mongo.aggregate(nconf.get('schema').impressions,
            publicMatch, publicCount)
        ])
        .then(function(mixed) {
            var dates = _.first(mixed);
            var visib = _.last(mixed);

            return _.map(dates, function(tle) {
                var timelineId = tle['_id'];
                var visible = _.find(visib, {_id: timelineId}).visible;

                var dates = _.reverse(_.map(tle.timings, function(e) { return moment(e); }));

                /* this might be influenced by the server time, hand is better if 
                 * computed client side */
                var x = moment.duration(_.first(dates) - _.last(dates)).humanize();

                return {
                    startTime: (_.first(dates)).format("YYYY-MM-DD"),
                    when: moment.duration( moment() - _.first(dates) ).humanize() + " ago",
                    duration: x,
                    visible: visible,
                    total: tle.impressions,
                    timelineId: timelineId
                }
            });
        })
        .then(function(fixed) {
            return { json: fixed };
        });
};

function getMetadata(req) {

    var timelineId = /^[a-fA-F0-9]+$/.exec(req.params.timelineId);
            
    if(!timelineId)
        throw new Error("Invalid request");

    timelineId = _.first(timelineId);
    debug("%s getMetadata timelineId %d", req.randomUnicode, timelineId);

    return mongo
        .read(nconf.get('schema').htmls, { timelineId: timelineId })
        .then(function(dirtyc) {
            var cleanc = _.map(dirtyc, function(e) {
                return _.omit(e, ['html', '_id', 'userId']);
            });
            return { json: cleanc };
        });
};

function contribution(req) {
    var numId = _.parseInt(req.params.userId);
    debug("contribution for user %d", numId);
};

function promoted(req) {
    var numId = _.parseInt(req.params.userId);
    var skip = _.parseInt(req.params.skip);
    var amount = _.parseInt(req.params.amount);

    var startD = moment().subtract(skip, 'd');
    var endD = moment().subtract(skip, 'd').subtract(amount, 'd');

    debug("promoted seen by user %d skip %d amount %d", numId, skip, amount);
    return mongo
        .aggregate( nconf.get('schema').htmls,
                    { userId: numId, 
                        savingTime: { "$lt": new Date( startD.toISOString() ) }, 
                        savingTime: { "$gt": new Date( endD.toISOString() ) }, 
                      promotedTitle: true, type: 'promoted' },
                    { _id: { titleId: "$titleId" },
                      impressions: { $sum: 1 },
                      title: { $addToSet: "$title" }
                    })
        .then(function(C) {
            debugger;
        });
};

function heatmap(req) {
    var numId = _.parseInt(req.params.userId);
    var skip = _.parseInt(req.params.skip);
    var amount = _.parseInt(req.params.amount);

    var startD = moment().subtract(skip, 'd');
    var endD = moment().subtract(skip, 'd').subtract(amount, 'd');

    debug("heatmap of activities by user %d skip %d req %d", numId, skip, amount);
    return mongo
        .aggregate( nconf.get('schema').impressions,
                    { userId: numId, 
                        impressionTime: { "$lt": new Date( startD.toISOString() ) }, 
                        impressionTime: { "$gt": new Date( endD.toISOString() ) }
                    },
                    { _id: {
                        year: { $year: "$impressionTime" },
                        month: { $month: "$impressionTime" },
                        day: { $dayOfMonth: "$impressionTime" },
                        hour: { $hour: "$impressionTime" }
                    }, impressions: { $sum: 1 } })
        .map(function(C) {
            var t = C['_id'];
            return {
                /*
                 * > moment({"year":2017,"month":1,"day":23,"hour":16})
                 * moment("2017-02-23T16:00:00.000")
                 * -- THIS IS SICK!!
                 */
                when: moment(t).subtract(1, 'M').unix() * 1000,
                impressions: C.impressions
            }
        })
        .reduce(function(memo, hourlyentry) {
            if(!skip)
                debug("Last 24H debug: %s → %d", moment(hourlyentry.when), hourlyentry.impressions);
            if(_.isInteger(hourlyentry.when))
                _.set(memo, hourlyentry.when / 1000, hourlyentry.impressions);
            return memo;
        }, {})
        .then(function(heatmapf) {
            return { json: heatmapf };
        });
};


module.exports = {
    getTimelines: getTimelines,
    getMetadata: getMetadata,

    contribution: contribution,
    promoted: promoted,
    heatmap: heatmap
};
