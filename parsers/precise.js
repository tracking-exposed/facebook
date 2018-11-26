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

return mongo
    .readOne(nconf.get('schema').htmls, { id: targetId })
    .then(function(html) {
        return mongo
            .readOne(nconf.get('schema').impressions, { id: html.impressionId })
            .then(function(impression) {
                _.unset(impression, 'id');
                return _.merge(html, impression);
            });
    })
    .then(parse.impression)
    .tap(parse.save)
    .then(function(result) {
        debug("%s", JSON.stringify(result, undefined, 2));
    });
