#!/usr/bin/env node
var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('0006-unique-supporters');
var moment = require('moment');
var nconf = require('nconf');

var mongo = require('../lib/mongo');

var cfgFile = "config/settings.json";
nconf.argv().env().file({ file: cfgFile });

/* this script might run more than once, the point is
 * removing duplicated entry */
function findTheDups(memo, user) {
    if(memo.unique.indexOf(user.userId) !== -1)
        memo.dups.push(user.userId);
    else
        memo.unique.push(user.userId);
    return memo;
};

function getDups(aggro) {
    var dups = _.uniq(aggro.dups);
    debug("Unique users: %d, duplicated %d",
        _.size(aggro.unique), _.size(aggro.dups));
    return dups;
};

function howMany(lst) {
    debug("Now we've %d elements", _.size(lst));
};

function removeTheBad(dupId) {
    return mongo
        .read(nconf.get('schema').supporters, {userId: dupId})
        .map(function(dupporter) {
            if(!_.get(dupporter, 'version'))
                return mongo
                    .remove(nconf.get('schema').supporters, { '_id': dupporter['_id'] });
        });
};

function conversion() {
    return mongo
        .read(nconf.get('schema').supporters)
        .tap(howMany)
        .reduce(findTheDups, { unique: [], dups: [] })
        .then(getDups)
        .tap(howMany)
        .map(removeTheBad)
        .then(function(results) {
            debug("Done!");
            debug("if they keep show up as duplicated, is OK: maybe they have different publicKey");
        });
};

return conversion();
