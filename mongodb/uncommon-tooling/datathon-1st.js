#!/usr/bin/env node
const moment = require('moment');
const _ = require('lodash');
const mongo = require('../../lib/mongo');
const various = require('../../lib/various');
const Promise = require('bluebird');
const debug = require('debug')('datathon');

const nconf = require('nconf');
nconf.argv().env().file({ file: 'config/collector.json' })

return Promise.map(_.times(52), function(wn) {

    x = moment({year: 2018}).add(wn, 'w');
    return mongo
        .readLimit(nconf.get('schema').timelines, { startTime: { "$gt": new Date(x.format()) }}, { startTime: 1 }, 20, 0)
        .map(function(l) {
            return l.id;
        });
}, { concurrency: 1})
.map(function(entries, n) {
    const ready = { timelineId: { "$in" : entries }}
    return various.dumpJSONfile(`/tmp/week-${n+1}.json`, ready);
});

/* this input is feed to a mongoscript */
