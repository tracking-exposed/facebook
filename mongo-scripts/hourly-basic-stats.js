#!/usr/bin/env nodejs
var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('hourly-basic-stats');
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
        nconf.get('HOURSAGO'), 1, 'h'
    );
debug("Executing timewindow: %s", timutils.prettify(timeFilter));

function getLocalizedAccesses() {
    var filter = { when: {
        "$gt": new Date(timeFilter.start),
        "$lt": new Date(timeFilter.end)
    } };
    var group = { _id: { ccode: "$ccode"},
                  amount: { $sum: 1} };
    return mongo
      .aggregate(nconf.get('schema').accesses, filter, group)
      .reduce(function(memo, c) {
          memo.visits += c.amount;
          var ccode = c["_id"]["ccode"];
          if(!ccode)
              ccode = "redacted";
          else if(ccode && _.size(ccode ) !== 2 && ccode !== "redacted")
              debug("unexpected `ccode` %s", ccode);
          memo[ccode] = c.amount;
          return memo;
      }, { visits: 0 });
}

function getLocalizedTimelines() {
    var filter = { startTime: {
        "$gt": new Date(timeFilter.start),
        "$lt": new Date(timeFilter.end)
    } };
    var group = { _id: { geoip: "$geoip" },
                  amount: { $sum: 1} };
    return mongo
      .aggregate(nconf.get('schema').timelines, filter, group)
      .reduce(function(memo, c) {
          memo.timelines += c.amount;
          var geoip = c["_id"]["geoip"];
          if(!geoip)
              geoip = "redacted";
          else if(geoip && _.size(geoip) !== 2 && geoip !== "redacted")
              debug("unexpected `geoip` %s", geoip);
          memo[geoip] = c.amount;
          return memo;
      }, { timelines: 0});
}

function getHTMLs() {
    var filter = { savingTime: {
        "$gt": new Date(timeFilter.start),
        "$lt": new Date(timeFilter.end)
    } };
    return mongo
      .countByMatch(nconf.get('schema').htmls, filter);
}

function getImpressions() {
    var filter = { impressionTime: {
        "$gt": new Date(timeFilter.start),
        "$lt": new Date(timeFilter.end)
    } };
    return mongo
      .countByMatch(nconf.get('schema').impressions, filter);
}

function getNewSupporters() {
    var filter = { keyTime: {
        "$gt": new Date(timeFilter.start),
        "$lt": new Date(timeFilter.end)
    } };
    return mongo
      .countByMatch(nconf.get('schema').supporters, filter);
}


function mergeAndSave(mixed) {

    var results = {
        start: new Date(timeFilter.start),
        visits: mixed[0].visits,
        visitcc: _.omit(mixed[0], ['visits']),
        timelines: mixed[1].timelines,
        timelinecc: _.omit(mixed[1], ['timelines']),
        newsupporters: mixed[2],
        htmls: mixed[3],
        impressions: mixed[4],
        id: utils.hash({ start: timeFilter.start, type: 'basic' }),
        type: 'basic' 
            /* basic I/O stats, not to be confunded with 'metadata' stats */
    };

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


return Promise
  .all([ getLocalizedAccesses(),
         getLocalizedTimelines(),
         getNewSupporters(),
         getHTMLs(),
         getImpressions(), ])
  .then(mergeAndSave);
