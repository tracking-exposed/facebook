#!/usr/bin/env node
var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('0004-accesses');
var moment = require('moment');
var nconf = require('nconf');

var mongo = require('../lib/mongo');

var cfgFile = "config/settings.json";
nconf.argv().env().file({ file: cfgFile });

function convertAccesses() {

    return mongo
        .read('accesses', {})
        .tap(function(x) {
            debug("the accesses are %d", _.size(x));
        })
        .map(function(blah, i) {

            var clean = _.pick(blah, ['when', 'ccode', 'referer' ]);
            clean.when = new Date(clean.when);
            clean.details = { 'page': blah.details.name };

            if(i % 400 === 0)
                debug("%d", i);

            return clean;
        }, {concurrency: 8})
        .then(function(block) {
            debug("saving size %d", _.size(block));
            if(_.size(block))
                return mongo.writeMany('accesses2', block);
        });
};

return convertAccesses();
