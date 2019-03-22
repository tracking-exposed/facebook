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
const override = nconf.get('override');
let htmlfilter = {};

if( _.size(override) > 3 ) {
    console.log("`override` present, using", override);
    htmlfilter = JSON.parse(override);
} else if(!targetTmlnId) {
    console.log("Required a timelineId as parameter (--id)");
    return;
} else {
    debug("addressing timeline %s", targetTmlnId);
    htmlfilter = { timelineId: targetTmlnId };
}

const repeat = nconf.get('repeat') || false;
if(repeat)
    htmlfilter = _.extend(htmlfilter, { processed: { $exists: false } });

htmlfilter = _.extend(htmlfilter, { savingTime: { "$gt": new Date("2019-02-15") } });

return parse
    .parseHTML(htmlfilter, repeat)
    .tap(function(results) {
        debug("completed: %s", JSON.stringify(results, undefined, 2));
    }); 
