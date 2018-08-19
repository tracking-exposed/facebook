#!/usr/bin/env node
var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('qualitative');
var moment = require('moment');
var nconf = require('nconf');

var mongo = require('../lib/mongo');
var various = require('../lib/various');
var tagId = require('../lib/tagId');
var research = require('../lib/research');

var cfgFile = "config/settings.json";
var rFile = "config/researches.json";

nconf.argv().env().file({ file: cfgFile });
if(!(nconf.get("since") && nconf.get("researcher"))) {
    console.log("'since' [until] 'researcher' are mandatory. (research name, check in ", rFile);
    process.exit(1);
}

var rname = nconf.get('researcher');
var timeFilter = { 
    start: moment(nconf.get('since')),
    end: nconf.get('until') ? moment(nconf.get('until')) : moment()
}
var timediff = moment.duration(timeFilter.end - timeFilter.start);
var qualitative = [];
var collection = null;

debug("Generation of collection %s for qualitative analysis, time window %s (%s)",
    rname, JSON.stringify(timeFilter, undefined, 2), timediff.humanize() );

function shrinkPost(o) {
    _.set(o, 'qualitative', qualitative);
    return _.omit(o, ['savingTime', 'impressionTime', 'impressionOrder', 'impressionId', 'timelineId']);
}

function getTimelinesByUsers(userId) {
    return mongo.read(nconf.get('schema').timelines, {
        startTime: {
            "$gt": new Date(timeFilter.start),
            "$lt": new Date(timeFilter.end) 
        },
        nonfeed: { "$exists": false },
        userId: _.parseInt(userId)
    })
    .tap(function(timelines) {
        debug("users %s returns %d timelines", userId, _.size(timelines));
    });
}

return various
    .loadJSONfile(rFile)
    .then(function(researchConfig) {
        var objsf = _.get(researchConfig[rname], 'objects');
        qualitative = _.reduce(objsf, function(memo, fields, groupName) {
            _.each(fields, function(f) {
                memo.push({
                    group: groupName,
                    field: f,
                    value: null
                });
            });
            return memo;
        }, []);
        debug("qualitative analysis has %d fields", _.size(qualitative));
        collection = _.get(researchConfig[rname], 'collection');

        return _.get(researchConfig, rname);
    })
    .then(function(settings) {
        if(!settings)
            console.log("Invalid researcher name?, not found!");

        return Promise
            .map(settings.users, getTimelinesByUsers, { concurrency: 1})
            .then(_.flatten)
            .tap(function(t) {
                debug("timelines %d", _.size(t));
            })
            .map(tagId.acquireTimeline, { concurrency: 1 })
            .then(_.flatten)
            .then(function(i) {
                debug("impressions %d", _.size(i));

                return _.reduce(_.groupBy(i, 'postId'), function(memo, posts, pid) {

                    var o = _.first(posts);

                    o.publicationTime = new Date(o.publicationTime);
                    o.impressionTime  = new Date(o.impressionTime);
                    o.occurrencies = _.map(posts, function(p) {
                        return new Date(p.impressionTime);
                    });

                    memo.push(shrinkPost(o));
                    return memo;
                }, []);
            })
            .then(function(p) {
                debug("posts %d", _.size(p));
                return mongo.writeMany(collection, p);
            });
    })
    .tap(function() {
        debug("done");
    });
