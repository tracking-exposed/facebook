#!/usr/bin/env node
var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('parserectomy');
var moment = require('moment');
var nconf = require('nconf');

var mongo = require('../lib/mongo');

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

if(!nconf.get('KEYS') && !nconf.get('since')) {
    console.log("KEYS format is discrimKey-keytoremove1,keytoremove2");
    console.log("since is YYYY-MM-DD mandatory");
    return 0;
}
var keys = importKeys(nconf.get('KEYS'));
var timew = _.parseInt('timew') || 14;
var since = nconf.get('since');
var total = 0;

debug("%s using timew shift of %d hours", JSON.stringify(keys, undefined, 2), timew);

var slots = _.times(_.round( moment.duration( moment() - moment(since) ).asHours() / timew ), function(shift) {
    return 1 + shift;
});

debug("%d shifts ahead", _.size(slots));
var start = moment();

return Promise
    .map(slots, cleanABlock, { concurrency: 1} )
    .tap(function(completed) {
        debug("operation complete after %s, %d html updated", moment.duration( moment() - start).humanize(), total );
    });


function cleanABlock(shift) {
    var startM  = moment(nconf.get('since')).add( timew * (shift -1), 'h');
    var endM  = moment(nconf.get('since')).add( timew * shift, 'h');

    if(nconf.get('until') && moment(nconf.get('until')).isAfter(startM)) {
        debug("until date trigger: %s isAfter %s", nconf.get('until'), startM.format() );
        process.exit();
    }

    var state = {
        start: startM.toISOString(),
        end: endM.toISOString(),
    };

    var selector = {
        "savingTime": { "$gt": new Date(state.start), "$lt": new Date(state.end) }
    }
    _.set(selector, keys.discrimK, { "$exists": true });

    return mongo
        .read(nconf.get('schema').htmls, selector)
        .map(function(he) {
            return _.omit(he, keys.tbremK);
        })
        .then(function(htelems) {
            if(_.size(htelems)) {
                debug("1st among %d, %s of %s starts with %d fields",
                    _.size(htelems),
                    htelems[0].id, moment(htelems[0].savingTime).format("YYYY-MM-DD"),
                    _.size(htelems[0]));
                total += _.size(htelems);
                return mongo
                    .updateMany(nconf.get('schema').htmls, htelems);
            }
        })
        .catch(function(error) {
            debug("Error in update! %s", error);
            process.exit();
        });
}

/* comma separared string, like: "postType,type" */
function importKeys(csStr) {
    debug("Splitting string KEYS [%s]", csStr);
    var f = csStr.split('-');
    var alls = f[1].split(',');
    return {
        discrimK: f[0],
        tbremK: alls
    };
};

