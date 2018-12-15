#!/usr/bin/env node
var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('parser:timeline');
var nconf = require('nconf');

var walk = require('../lib/walk');
var parse = require('../lib/parse');
var mongo = require('../lib/mongo');
var parse = require('../lib/parse');

nconf.argv().env().file({ file: 'config/collector.json' });

const targetTmlnId = nconf.get('id');

if(!targetTmlnId) {
    console.log("Required a timelineId as parameter (--id)");
    return;
}

debug("addressing timeline %s", targetTmlnId);
const repeat = nconf.get('repeat') || false;
const htmlfilter = repeat ?
    { timelineId: targetTmlnId } :
    { timelineId: targetTmlnId, processed: { $exists: false } };

return parse
    .parseHTML(htmlfilter, repeat)
    .tap(function(results) {
        debug("completed: %s", JSON.stringify(results, undefined, 2));
    }); 
