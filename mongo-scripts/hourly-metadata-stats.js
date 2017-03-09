#!/usr/bin/env nodejs
var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('hourly-metadata-stats');
var moment = require('moment');
var nconf = require('nconf');

var utils = require('../lib/utils');
var mongo = require('../lib/mongo');
var timutils = require('../lib/timeutils');

var cfgFile = "config/settings.json";
nconf.argv().env().file({ file: cfgFile });

var timeFilter = timutils.doFilter(
        nconf.get('HOURSAFTER'), 
        nconf.get('DAYSAGO'), 
        nconf.get('HOURSAGO'), 1, 'h'
    );
debug("Executing timewindow: %s", timutils.prettify(timeFilter));

var infomap = [
    { type: "$type" },
    { hrefType: "$hrefType" },
    { postId: { "$cond": [{ "$gt": [ "$postId", 0 ] }, "postId", null ] }},
];

function mergeAndSave(mixed) {

    var f = _.reduce(mixed, function(memo, i) {
        return _.assign(memo, i);
    }, {});

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

function countBy(input) {
    var match = { savingTime: {
        "$gt": new Date(timeFilter.start),
        "$lt": new Date(timeFilter.end)
    } };
    var group = { "_id": input, "count": { "$sum": 1 } };
    return mongo
        .aggregate(nconf.get('schema').htmls, match, group)
        .then(function(counted) {
            /* is a list of object so shaped: [
             { "_id": { "hrefType": "photo" },
               "count": 51 }, { ... }] */
            return _.reduce(counted, function(memo, info) {
                var value = _.first(_.values(info["_id"]));
                if(_.isNull(value))
                    return memo;
                memo[value] = info.count;
                return memo;
            }, {});
        });
};

return Promise
    .map(infomap, countBy)
    .then(mergeAndSave);
