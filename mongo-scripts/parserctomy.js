#!/usr/bin/env nodejs
var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('parser-error-mngmnt');
var moment = require('moment');
var nconf = require('nconf');

var mongo = require('../lib/mongo');
var timutils = require('../lib/timeutils');

var cfgFile = "config/settings.json";
nconf.argv().env().file({ file: cfgFile });

function cleanABlock(keyinfo, std, blockSize) {
    var discrimK = keyinfo.discrimK;
    var tbremK = keyinfo.tbremK;

    var selector = {
        "savingTime": { "$gt": new Date(std) }
    }
    _.set(selector, discrimK, { "$exists": true });

    return mongo
        .readLimit(nconf.get('schema').htmls, selector, {}, blockSize, 0)
        .map(function(he) {
            return _.omit(he, tbremK);
        })
        .then(function(htelems) {
            debug("First elements processed now is from %s and has %d fields",
                htelems[0].savingTime, _.size(htelems[0]));
            return mongo
                .updateMany(nconf.get('schema').htmls, htelems);
        })
        .then(function(htelems) {
            return _.size(htelems);
        });
}

function recursiveRemoval(k, std, blockSize) {

    return cleanABlock(k, std, blockSize)
        .then(function(numbers) {
            if(numbers < blockSize) {
                debug("Process completed!");
                return;
            } else {
                return recursiveRemoval(k, std, blockSize);
            }
        });
};

function removeParserData(k, std) {
    var blockSize = 2000;
    debug("Removing keys %j starting since %s, processin %d block per time",
        k, std, blockSize);
    return recursiveRemoval(k, std, blockSize);
};

/* comma separared string, like: "postType,type" */
function importKeys(csStr) {
    debug("Splitting string KEYS [%s] expecting a string with 0 or more commas and 0 or more dash", csStr);
    var f = csStr.split('-');
    var alls = f[1].split(',');
    return {
        discrimK: f[0],
        tbremK: alls
    };
};

/* YYYY-MM-DD expected here */
function importStartDate(dateStr) {
    debug("Parsing string START [%s] expecting a YYYY-MM-DD", dateStr);
    var dat = moment(dateStr);
    return dat;
};

var keys = importKeys(nconf.get('KEYS'));
var startDay = importStartDate(nconf.get('START'));

debug("Addressing keys: %j since %s", keys, startDay);

return removeParserData(keys, startDay);
