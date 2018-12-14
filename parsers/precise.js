#!/usr/bin/env node
var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('parser:precise');
var nconf = require('nconf');

var walk = require('../lib/walk');
var parse = require('../lib/parse');
var mongo = require('../lib/mongo');

var targetId = nconf.get('id');
if(!targetId) {
    console.log("Required id as parameter");
    return;
}

nconf.argv().env().file({ file: 'config/collector.json' });
return precise(targetId);

function precise(targetId) {

    debug("addressing %s", targetId);
    return mongo
        .readOne(nconf.get('schema').htmls, { id: targetId })
        .then(function(html) {
            if(!html || !html.impressionId)
                return null;

            return mongo
                .readOne(nconf.get('schema').impressions, { id: html.impressionId })
                .then(function(impression) {
                    _.unset(impression, 'id');
                    _.unset(impression, 'htmlId');
                    return _.merge(html, impression);
                });
        })
        .then(function(single) {
            return [ single ];
        })
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
    precise: precise
};
