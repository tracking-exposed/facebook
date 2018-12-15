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
            .processHTML(timeline.id, repeat)
            .then(function(done) {
                debug("Done timeline %s (%s %s) %s: %d",
                    timeline.id,
                    timeline.startTime,
                    moment.duration(moment(timeline.startTime) - moment()).humanize(),
                    timeline.geoip, _.size(done)
                );
                return _.size(done);
            });
    }, { concurrency: 1 })
    .then(function(done) {
        debug("Completed %d timelines!", _.size(done));
    });
