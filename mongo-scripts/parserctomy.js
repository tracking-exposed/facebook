#!/usr/bin/env nodejs
var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('parserectomy');
var moment = require('moment');
var nconf = require('nconf');

var mongo = require('../lib/mongo');
var timutils = require('../lib/timeutils');

var cfgFile = "config/settings.json";
nconf.argv().env().file({ file: cfgFile });

/*
 * example:
 *
 * mongodb="mongodb://10.0.2.2/facebook" KEYS="interactions-interactions,rmap" DEBUG=* START=2017-10-01 mongo-scripts/parserctomy.js 
 *
 */

function cleanABlock(keyinfo, std) {
    var discrimK = keyinfo.discrimK;
    var tbremK = keyinfo.tbremK;
    var blockSize = 2000;

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
            if(_.size(htelems)) {
                debug("sample: from %s %s begin with %d fields",
                    htelems[0].id, htelems[0].savingTime,
                    _.size(htelems[0]));
                return mongo
                    .updateMany(nconf.get('schema').htmls, htelems)
                    .catch(function(error) {
                        debug("Error in update (redo): %s", error);
                        return [ null ];
                    });
            }
        })
        .then(function(htelems) {
            if(!_.size(htelems))
                return -1;
            return _.size(htelems);
        });
}

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
    debug("Parsing string $since [%s] expecting a YYYY-MM-DD", dateStr);
    var dat = moment(dateStr);
    return dat;
};

debug("KEYS format is discrimKey-keytoremove1,keytoremove2");
var keys = importKeys(nconf.get('KEYS'));
var startDay = importStartDate(nconf.get('since'));

debug("Addressing keys: %j since %s", keys, startDay);

/* thanks stackoverflow https://stackoverflow.com/questions/24660096/correct-way-to-write-loops-for-promise */
var promiseFor = Promise.method(function(condition, action, value) {
    if (!condition(value)) return value;
    return action(value).then(promiseFor.bind(null, condition, action));
});

promiseFor(function(numbers) {
    return numbers >= 0;
}, function(count) {
    return cleanABlock(keys, startDay);
}, 0).then(function() {
    debug("operation complete!");
});

