#!/usr/bin/env node
var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('parser:timeline');
var nconf = require('nconf');

var walk = require('../lib/walk');
var parse = require('../lib/parse');
var mongo = require('../lib/mongo');

var targetTmlnId = nconf.get('id');
if(!targetTmlnId) {
    console.log("Required a timelineId as parameter (--id)");
    return;
}

nconf.argv().env().file({ file: 'config/collector.json' });
return bytimeline(targetTmlnId);

function bytimeline(targetTmlnId) {

    debug("addressing timeline %s", targetTmlnId);
    return mongo
        .read(nconf.get('schema').htmls, { timelineId: targetTmlnId })
        .tap(function(htmls) {
            debug("Found %d htmls linked to the timeline", _.size(htmls));
        })
        .map(function(html) {
            return mongo
                .readOne(nconf.get('schema').impressions, { id: html.impressionId })
                .then(function(impression) {
                    _.unset(impression, 'id');
                    _.unset(impression, 'htmlId');
                    return _.merge(html, impression);
                });
        }, { concurrency: 4 })
        .then(_.compact)
        .map(function(e) {
            return parse.impression(e, nconf.get('repeat') || false);
        })
        .then(_.compact)
        .then(parse.stats)
        .tap(parse.mark)
        .tap(parse.save);
}

module.exports = {
    bytimeline: bytimeline
};
