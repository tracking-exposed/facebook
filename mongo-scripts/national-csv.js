#!/usr/bin/env nodejs
var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('hourly-usage');
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

debug("Executing timewindow: %s and nation %s",
    timutils.prettify(timeFilter), sourceNation);


    var filter = { startTime: {
        "$gt": new Date(timeFilter.start),
        "$lt": new Date(timeFilter.end)
    } };

function getImpressions() {
    var filter = { impressionTime: {
        "$gt": new Date(timeFilter.start),
        "$lt": new Date(timeFilter.end)
    } };
    return mongo
      .countByMatch(nconf.get('schema').impressions, filter);
}

function appendCSV(timeline) {
    return mongo.read(
}


function getTimelineByCountry(tlc) {

    debug("Having as TLC %s", tlc);

    var filter = { startTime: {
        "$gt": new Date(timeFilter.start),
        "$lt": new Date(timeFilter.end)
    }, geoip: tlc };
    return mongo
        .read(nconf.get('schema').timelines, filter, {startTime: -1})
};

return getTimelinesByCountry(sourceNation)
  .tap(startCSV)
  .map(appendCSV, { concurrency: 20 });
