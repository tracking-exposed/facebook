#!/usr/bin/env node
var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('0008-user-pseudo');
var moment = require('moment');
var nconf = require('nconf');
var crypto = require('crypto');

var mongo = require('../../lib/mongo');
var utils = require('../../lib/utils');

var cfgFile = "config/collector.json";
nconf.argv().env().file({ file: cfgFile });

function howMany(lst) {
    debug("There are %d objects", _.size(lst));
};

function writeNewPseudos(supporter) {

    supporter.pseudo = utils.pseudonymizeUser(supporter.userId);
    return mongo
        .updateOne(nconf.get('schema').supporters, { _id: supporter._id }, supporter);
};

return mongo
    .read(nconf.get('schema').supporters, {}, {})
    .tap(howMany)
    .map(writeNewPseudos, { concurrency: 1})
    .then(function(results) {
        debug("Completed conversion of %d objects", _.size(results));
    });
