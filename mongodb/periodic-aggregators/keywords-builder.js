#!/usr/bin/env node
const _ = require('lodash');
const Promise = require('bluebird');
const debug = require('debug')('keywords-builder');
const moment = require('moment');
const nconf = require('nconf');

const mongo = require('../../lib/mongo');
const various = require('../../lib/various');
const semantic = require('../../lib/semantic');

const cfgFile = "config/content.json";
nconf.argv().env().file({ file: cfgFile });

const weeksago = _.parseInt(nconf.get('weeksago')) ? _.parseInt(nconf.get('weeksago')) : 1;
const dpath = "rss/keywords";

function languageFile(lc) {
    let ref = new Date(moment().subtract(weeksago, 'week').toISOString());
    return mongo
        .aggregate( nconf.get('schema').semantics, [
            { $match: { 'lang': lc, when: { $gt: ref }}},
            { $group: { _id: "$label", c: { $sum: 1 }}},
            { $match: { c: { $gt: 1 }}},
            { $project: { k: "$_id", _id: 0, c: true }}
        ])
        .then(function(l) {
            if(!_.size(l))
                return null;

            debug("Writing language '%s' (%d) entries", semantic.langMap[lc], _.size(l));
            return various
                .dumpJSONfile(`${dpath}/${lc}.json`, l)
                .then(function() {
                    let rv = {};
                    _.set(rv, lc, _.size(l));
                    return rv;
                });
        });
};

console.log("Please remind: better if you delete by hand rss/keywords/*.json so you ensure language with 0 entries are not served");
console.log("Please remind: hardcoded 1 week of history");
return mongo
    .distinct(nconf.get('schema').labels, 'lang')
    .map(languageFile, { concurrency: 1 })
    .then(_.compact)
    .then(function(collection) {
        return _.reduce(collection, function(memo, e) {
            return _.merge(memo, e);
        }, {});
    })
    .then(function(writtenLangs) {
        debug("Written %d languages over the %d available", _.size(writtenLangs), _.size(semantic.langMap));
        return various.dumpJSONfile(`${dpath}/available.json`, writtenLangs);
    });
