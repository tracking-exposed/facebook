#!/usr/bin/env node
var Promise = require('bluebird');
var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('parser:range');
var nconf= require('nconf');

var mongo = require('../lib/mongo');
var parse = require('../lib/parse');

nconf.argv().env().file({ file: 'config/collector.json' });
const since = nconf.get('since') || "2018-11-01";
const concur = _.isUndefined(nconf.get('concurrency') ) ? 1 : _.parseInt(nconf.get('concurrency') );

return mongo
    .read(nconf.get('schema').timelines, { startTime: { "$gt": new Date(since) } }, { startTime: -1})
    .tap(function(timelines) {
        debug("Retieved %d timelines since %s", _.size(timelines), since);
    })
    .map(function(timeline) {

        const repeat = nconf.get('repeat') || false;
        const htmlfilter = repeat ?
                { timelineId: timeline.id } :
                { timelineId: timeline.id, processed: { $exists: false } }; 

        return parse
            .parseHTML(htmlfilter, repeat)
            .then(function(done) {
                if(!done || !done.metadata) {
                    debug("No effect on timeline %s (%s %s) %s",
                        timeline.id,
                        moment(timeline.startTime).format("YYYY-MM-DD"), 
                        moment.duration(moment(timeline.startTime) - moment()).humanize(),
                        timeline.geoip);
                } else {
                    debug("Done timeline %s (%s %s) %s: %d metadata, %d errors",
                        timeline.id,
                        moment(timeline.startTime).format("YYYY-MM-DD"), 
                        moment.duration(moment(timeline.startTime) - moment()).humanize(),
                        timeline.geoip, done.metadata, done.errors);
                }
                return _.size(done);
            });
    }, { concurrency: concur })
    .then(function(done) {
        debug("Completed %d timelines!", _.size(done));
    });
