#!/usr/bin/env nodejs
var _ = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('realityreduction');
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
        nconf.get('HOURSAGO'), 
        _.parseInt(nconf.get('DAYS')), 'd'
    );

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

debug("Executing timewindow: %s and nation",
    timutils.prettify(timeFilter));

function getFromHtmls(timeline) {
    return mongo
        .read(nconf.get('schema').htmls, { timelineId: timeline.id, type: 'feed' })
        .reduce(function(memo, e) {
            if(!e || !e.id)
                return memo;

            memo[e.id] = _.pick(e, ['id', 'publicationUTime', 'postId', 'permaLink', 'timelineId' ]);
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

function reality(timeline, counter) {

    var nation = timeline.geoip;
    /* TODO control group */
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
            fix.nation = nation;
            fix.publicationUTime = moment(_.parseInt(metadata.publicationUTime) * 1000).toISOString();
            debugger;
            // timelineincremental 
            return fix;
        });
    })
    .then(function(content) {
        debug("Saving %d entries", _.size(content));

            var results = _.extend(f, {
                start: new Date(timeFilter.start),
                id: utils.hash({
                    start: timeFilter.start,
                    infos : JSON.stringify(infomap)
                }),
                type: 'metadata'
            });

            return mongo
              .read(nconf.get('schema').hourlyIO, {id: results.id })
              .then(function(exists) {
                  if(_.size(exists)) {
                    debug("Updting previous stats, starting at %s", results.start);
                    /* TODO: line by line comparison and diffs highlight */
                    debug("%s", JSON.stringify(results, undefined, 2));
                    return mongo
                      .updateOne(nconf.get('schema').hourlyIO, {id: results.id}, results);
                  } else {
                    debug("Writing stats, starting at %s", results.start);
                    debug("%s", JSON.stringify(results, undefined, 2));
                    return mongo
                      .writeOne(nconf.get('schema').hourlyIO, results);
                  }
              });
        };


        return mongo.writeMany(nconf.get('schema').reality, content);
    })
    .catch(function(error) {
        debug("Error: %s", error);
        return false;
    })
    .return(true);

}

function reportTimelines(timelines) {
    debug("Operating over %d timelines", _.size(timelines));
};

function preprocess(timeline) {

    var id = utils.hash({ 'start': timeFilter.start, 
        'type': 'reality',
        'userId': null 
    });

}

function getTimelinesByCountry(tlc) {

    var filter = { startTime: {
        "$gt": new Date(timeFilter.start),
        "$lt": new Date(timeFilter.end)
    }};


    debug("Selecting timelines as: %s", JSON.stringify(filter, undefined, 2));
    return mongo
        .read(nconf.get('schema').timelines, filter, {startTime: -1})
};

return getTimelinesByCountry()
  .tap(reportTimelines)
  .map(preprocess)
  .map(reality, { concurrency: _.parseInt(nconf.get('concurrency')) || 1 });



