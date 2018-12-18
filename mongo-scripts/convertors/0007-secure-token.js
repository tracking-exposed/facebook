#!/usr/bin/env nodejs
var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('0007-supporters');
var moment = require('moment');
var nconf = require('nconf');
var crypto = require('crypto');

var mongo = require('../lib/mongo');
var cfgFile = "config/settings.json";
nconf.argv().env().file({ file: cfgFile });

function howMany(lst) {
    debug("There are %d objects", _.size(lst));
};

function writeNewSecrets(supporter) {

    sha1sum = crypto.createHash('sha1');
    sha1sum.update(JSON.stringify({
        current: supporter.userSecret,
        random: _.random(0, 0xffffff),
        publicKey: supporter.publicKey
    }));
    supporter.userSecret = sha1sum.digest('hex');

    return mongo
        .updateOne(nconf.get('schema').supporters, { _id: supporter._id }, supporter);
};

return mongo
    .read(nconf.get('schema').supporters, {}, {})
    .tap(howMany)
    .map(writeNewSecrets, { concurrency: 1})
    .then(function(results) {
        debug("Completed conversion of %d objects", _.size(results));
    });
