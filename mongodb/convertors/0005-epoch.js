#!/usr/bin/env node
var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('0005-epoch');
var moment = require('moment');
var nconf = require('nconf');

var mongo = require('../lib/mongo');

var cfgFile = "config/settings.json";
nconf.argv().env().file({ file: cfgFile });

function getEpochTimelines() {
    return mongo
        .read('timelines2', { startTime: { $lt : new Date('1970-01-02') } });
}

function updateWithMeans(timeline, i) {

    if(i % _.random(100, 200) === 0)
        debug("%d", i);

    return mongo
        .read('impressions2', { timelineId: timeline.id }, {impressionTime: 1})
        .then(_.first)
        .then(function(impression) {

            if(!impression) {
                return mongo.remove('timelines2', { id: timeline.id });
            }

            /* you can't update, apparently, if _id is kept */
            timeline = _.omit(timeline, ['_id']);
            timeline.startTime = new Date(impression.impressionTime);

            return mongo
                .updateOne('timelines2', { id: timeline.id}, timeline)
                .catch(function(error) {
                    debug("updateOne error: %s", error);
                });
        });
}

return getEpochTimelines()
    .map(updateWithMeans, { concurrency: 1 })
    .then(function(stuffs) {
        debug("Done %d updates", _.size(stuffs));
    });
