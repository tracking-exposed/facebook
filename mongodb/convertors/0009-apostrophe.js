#!/usr/bin/env node
var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('0009-apostrophe');
var moment = require('moment');
var nconf = require('nconf');
var crypto = require('crypto');

var mongo = require('../../lib/mongo');
var utils = require('../../lib/utils');

var cfgFile = "config/content.json";
nconf.argv().env().file({ file: cfgFile });

function convertLabels(offset, slot) {
    let stats = { total: null, done: 0 };
    return mongo
        .readLimit(nconf.get('schema').labels, {}, {}, slot, offset)
        .tap(function(entries) {
            stats.total = _.size(entries);
        })
        .map(function(e) {
            stats.done += 1;
            if(!(stats.done % 300))
                debug("labels: %d/%d, %d%%", stats.done, stats.total, 
                    _.round(((100 / stats.total) * stats.done), 1));
            e.l = _.map(e.l, function(label) {
                return _.replace(label, "'", "’");
            });
            return mongo
                .updateOne(nconf.get('schema').labels, { _id: e._id }, e);
        }, {concurrency: 1})
        .then(_.size);
}

function convertSemantics(offset, slot) {
    let stats = { total: null, done: 0 };
    debug("offset at %d, slot at %d", offset, slot); 
    return mongo
        .readLimit(nconf.get('schema').semantics, {}, {}, slot, offset)
        .tap(function(entries) {
            stats.total = _.size(entries);
        })
        .map(function(e) {
            stats.done += 1;
            if(!(stats.done % 300))
                debug("semantics: %d/%d, %d%%", stats.done, stats.total, 
                    _.round(((100 / stats.total) * stats.done), 1));
            e.title = _.replace(e.title, "'", "’");
            return mongo
                .updateOne(nconf.get('schema').semantics, { _id: e._id }, e);
        }, {concurrency: 1})
        .then(_.size);
}

const offset = _.parseInt(nconf.get('offset'));
if(_.isNaN(offset)) {
    console.log("--offset mandatory");
    process.exit(1);
}


/*
   X:PRIMARY> db.semantics.count()
    1122843
   X:PRIMARY> db.labels.count()
    136162
 */

// labels 0 137
// return convertLabels(offset, 1000)
//     .then(console.log);

// semantics 0 1123
return convertSemantics(offset, 1000)
    .then(console.log);
