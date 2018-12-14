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

debug("Checking new timelines since %s", since);
return mongo
    .read(nconf.get('schema').timelines, { startTime: { "$gt": new Date(since) } })
    .map(function(timeline) {
        return parse
            .bytimeline(timeline.id)
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
