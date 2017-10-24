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
 *
 * mongodb="mongodb://10.0.2.2/facebook" KEYS="interactions-interactions,rmap" DEBUG=* since=2017-10-01 mongo-scripts/parserctomy.js 
 *                                             ^^^^^^^^^^^^ ^^^^^^^^^^^^^^^^^
 *                                     discriminative key/   \keys to be removed
 *
 * it removed the keys 'interactions' and 'rmap' from all the object with 'interactions'
 *
 * YYYY-MM-DD expected here */

function manageState(state) {
    var timewindow = 4; // hours
    var shifts = state.shifts + 1;
    var startM  = moment(nconf.get('since')).add( timewindow * (shifts -1), 'h');
    var endM  = moment(nconf.get('since')).add( timewindow * shifts, 'h');

    if(nconf.get('until') && moment(nconf.get('until')).isAfter(startM)) {
        debug("until date trigger: %s isAfter %s", nconf.get('until'), startM.format() );
        process.exit();
    }

    return {
        start: startM.toISOString(),
        end: endM.toISOString(),
        shifts: shifts,
    };
};

debug("KEYS format is discrimKey-keytoremove1,keytoremove2");
var keys = importKeys(nconf.get('KEYS'));
debug("keys: %j", keys);

/* thanks stackoverflow https://stackoverflow.com/questions/24660096/correct-way-to-write-loops-for-promise */
var promiseFor = Promise.method(function(condition, action, value) {
    if (!condition(value)) return value;
    return action(value).then(promiseFor.bind(null, condition, action));
});

promiseFor(function(timew) {

    /* if `start` is arrive in the future, its over */
    return moment(timew.start).isBefore();

},  cleanABlock,
    manageState({ shifts: 1 })
).then(function(completed) {
    debug("operation complete after %d shifts", completed.shifts);
});


function cleanABlock(state) {
    var discrimK = keys.discrimK;
    var tbremK = keys.tbremK;

    var selector = {
        "savingTime": { "$gt": new Date(state.start), "$lt": new Date(state.end) }
    }
    _.set(selector, discrimK, { "$exists": true });

    return mongo
        .read(nconf.get('schema').htmls, selector)
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
                    .return(state);
            } else {
                return manageState(state);
            }
        })
        .catch(function(error) {
            debug("Error in update, wait 2000ms and redo: %s", error);
            return Promise
                .delay(2000)
                .return(state);
        })
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

