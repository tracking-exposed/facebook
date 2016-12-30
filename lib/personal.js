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

module.exports = {
    getTimelines: getTimelines,
    getMetadata: getMetadata
};
