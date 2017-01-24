#!/usr/bin/env nodejs
var _ = require('lodash');
var debug = require('debug')('mongo-scripts:init-hourlyTI');
var child_process = require('child_process');
var moment = require('moment');

var nconf = require('nconf');
nconf.env();

var skipdays = nconf.get('SKIPDAYS') || 0;

if(!skipdays) {
    debug("Not skipping any day");
} else {
    debug("Skipping days %d starting hoursAfter %d",
        skipdays, skipdays * 24);
}

_.times(40000, function(hoursAfter) {
    hoursAfter += 1 + (skipdays * 24);
    debug("hoursAfter now is %d", hoursAfter);
    child_process.execSync('mongo-scripts/hourly-usage.js', {
        'env': {
            'DEBUG': '*,-lib:performa,-lib:mongo',
            'HOURSAFTER': hoursAfter
        }
    });
});
