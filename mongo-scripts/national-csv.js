#!/usr/bin/env nodejs
var _ = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('national-csv');
var moment = require('moment');
var nconf = require('nconf');

var utils = require('../lib/utils');
var mongo = require('../lib/mongo');
var timutils = require('../lib/timeutils');

var cfgFile = "config/settings.json";
nconf.argv().env().file({ file: cfgFile });

/*
 * when: `ISO date`
 * htmls: `Int`      | number of htmls
 * impressions: `Int`| guess what..
 * accesses: `Int`   | accesses, page views
 * active: `Int`     | timelines, count users + countries
 * new: `Int`        | supporters, `keyTime`
 */

var timeFilter = timutils.doFilter(
        nconf.get('HOURSAFTER'), 
        nconf.get('DAYSAGO'), 
        nconf.get('HOURSAGO'), 30, 'd'
    );
var sourceNation = nconf.get('nation');

if(!sourceNation)
    throw new Error("`sourceNation` as environment variable is required");

var destFile = sourceNation + "-" + moment(timeFilter.start).format("YYYY-MM-DD") +'+30d.csv';

var keys = [
    'id',
    'userPseudo',
    'publicationUTime',
    'impressionTime',
    'impressionOrder',
    'postId',
    'permaLink',
    'timelineId',
    'counter'
];

debug("Executing timewindow: %s and nation %s",
    timutils.prettify(timeFilter), sourceNation);

function getFromHtmls(timeline) {
    return mongo
        .read(nconf.get('schema').htmls, { timelineId: timeline.id, type: 'feed' })
        .reduce(function(memo, e) {
            if(!e || !e.id)
                return memo;

            var metadata = _.pick(e, ['id', 'publicationUTime', 'postId', 'permaLink', 'timelineId' ]);
            memo[e.id] = metadata;
            return memo;
        }, {});
};

function getFromImpressions(timeline) {
    return mongo
        .read(nconf.get('schema').impressions, { timelineId: timeline.id })
        .reduce(function(memo, imp) {
            if(!imp || !imp.htmlId)
                return memo;

            memo[imp.htmlId] = {
                userId: imp.userId,
                impressionOrder: imp.impressionOrder,
                impressionTime: moment(imp.impressionTime).toISOString(),
            };
            return memo;
        }, {});
};

function appendCSV(timeline, counter) {

    return Promise.all([
            getFromHtmls(timeline),
            getFromImpressions(timeline)
    ])
    .then(function(combos) {
        return _.map(combos[0], function(metadata, id) {

            if(!combos[1][id])
                throw new Error("impossible!?");

            var fix = _.extend(combos[1][id], metadata);
            fix.userPseudo = utils.numId2Words([1, fix.userId]);
            fix.counter = counter;
            return fix;
        });
    })
    .then(function(content) {
        var csvContent = _.reduce(content, function(memo, entry) {
            /* fill memo as side effect, use declared keys above */

            _.each(keys, function(k, i) {
                var swap;
                if(k === 'publicationUTime') {
                    swap = _.get(entry, k);
                    swap = moment(swap * 1000).toISOString();
                } else {
                    swap = _.get(entry, k, "");
                    swap = _.replace(swap, /\"/g, '〃');
                }
                memo +=  '"' + swap + '"';
                if(!_.eq(i, _.size(keys) - 1))
                    memo += ',';
            });
            memo += "\n";
            return memo;

        }, "");
        if(_.size(csvContent)) {
            debug("appending %d entries first %j", _.size(content), content[0]);
            return fs.appendFileAsync(destFile, csvContent, 'utf8');
        } else {
            debug("not appending");
        }
    })
    .catch(function(error) {
        debug("Error: %s", error);
        return false;
    })
    .return(true);

}

function startCSV(timelines) {
    debug("Operating over %d timelines, init %s", _.size(timelines), destFile);
    return fs
        .writeFileAsync(destFile, keys.join(",") + "\n")
};

function getTimelinesByCountry(tlc) {

    var filter = { startTime: {
        "$gt": new Date(timeFilter.start),
        "$lt": new Date(timeFilter.end)
    }, geoip: tlc };
    debug("Selecting timelines as: %s", JSON.stringify(filter, undefined, 2));
    return mongo
        .read(nconf.get('schema').timelines, filter, {startTime: -1})
};

return getTimelinesByCountry(sourceNation)
  .tap(startCSV)
  .map(appendCSV, { concurrency: _.parseInt(nconf.get('concurrency')) || 1 });
