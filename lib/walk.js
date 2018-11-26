var _ = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('lib:walk');
var moment = require('moment');
var nconf = require('nconf'); 

var mongo = require('./mongo');
nconf.argv().env().file({ file: "config/collector.json" });


module.exports = {
    composeRange: composeRange,
    please: please
};

function composeRange(since, until, range) {

    debug("I should not start with the loop but with the parser");

    // this return a list of since - until with the different of `range` hours
};

function fetchMetadata(config) {

    var defaults = {
        "since": moment().subtract(1, 'h').toISOString(),
        "until": moment().format('YYYY-MM-DD 23:59:59'),
        "parserName": config.name,
        "requirements": config.requirements || {}
    };

    /* if since or until are specify, use the command, 
     * otherwise use keep the default: last hour */
    if( nconf.get('since') || nconf.get('until') ) {
        debug("Remind: if you specify only one 'since' or 'until', the default is from the config");
        defaults.since = nconf.get('since') ? nconf.get('since') : config.since;
        defaults.until = nconf.get('until') ? nconf.get('until') : config.until;
    }

    /* id overwrites every other requirement */
    if(nconf.get('id')) {
        defauls.since = "2018-01-01";
        defaults.until = moment().format("YYYY-MM-DD 23:59:59");
        defaults.requirements = { id : nconf.get('id') };
    }
    debug("⭐ since: %s until %s%s", defaults.since, defaults.until,
        defaults.requiremenets ? "[+special id requested!]" : "");

    return mongo
        .read(nconf.get('schema').videos, _.extend({
                savingTime: {
                    '$gte': new Date(defaults.since),
                    '$lte': new Date(defaults.until) 
                }
            },
            _.get(defaults, 'requirements'),
            _.set({}, defaults.parserName, {'$exists': false} )))
        .tap(report("videos retrieved matching the time window"));
};

function report(text, objs) {
    debug("%s: %d", text, _.size(objs));
};

function please(config) {

    /* set default values if not specified */
    config.repeat = nconf.get('repeat') || null;

    if(!_.isObject(config.requirements)) {
        throw new Error(
            "Developer, requirements has to be an object and check `repeat`");
    }

    return fetchMetadata(config)
        .tap(report("found elements"))
        .map(function(metadata) {
            return fs
                .readFileAsync(metadata.htmlOnDisk, 'utf-8')
                .then(function(html) {
                    return config.implementation(metadata, html);
                })
                .catch(function(error) {
                    debug("Error %s", error.message);
                    // debug("Error %s", JSON.stringify(metadata, undefined, 2), error.message);
                    return null;
                })
                .then(function(updates) {
                    if(!updates)
                        return null;
                    return mongo
                        .updateOne(nconf.get('schema').videos, {id: metadata.id}, _.extend(updates, metadata))
                        .return(true);
                });
        }, { concurrency: 1 })
        .then(_.compact)
        .tap(report("linked"));
};

