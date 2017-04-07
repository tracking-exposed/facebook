var _ = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var request = Promise.promisifyAll(require('request'));
var cheerio = require('cheerio');
var debug = require('debug')('parser:⊹core');
var moment = require('moment');
var nconf = require('nconf'); 

nconf.argv().env();

function composeURL(what) {
    return [
        (nconf.get('url') || 'https://facebook.tracking.exposed' ),
        'api', 'v1', 'snippet', what
    ].join('/');
};

function snippetAvailable(config, what) {
    var url = composeURL(what);
    var requestpayload = {
        "since": nconf.get('since') ? nconf.get('since') : config.since,
        "until": nconf.get('until') ? nconf.get('until') : config.until,
        "parserName": config.name,
        "requirements": config.requirements || {}
    };

    /* id overwrites every other requirement */
    if(nconf.get('id'))
        requestpayload.requirements = { id : nconf.get('id') };

    debug("Connecting to %s", url);
    debug("⭐ %s", JSON.stringify(requestpayload, undefined, 2));

    var begin = moment();
    return request
        .postAsync(url, {form: requestpayload})
        .then(function(response) {
            if(_.size(response.body) < 3 && response.statusCode === 200) {
                debug("This query return zero HTMLs");
                return [];
            }
            return JSON.parse(response.body);
        })
        .catch(function(error) {
            debug("Error with %s: %s", url, error);
            throw new Error(error);
        })
        .tap(function() {
            debug("Execution completed in %d seconds",
                moment.duration(moment() - begin).asSeconds());
        });
};

function commitResult(config, newmeta, snippet) {
    debug("metadata was [%s] +[%s]",
        _.keys(
            _.omit(snippet, [
                '_id', 'savingTime', 'id', 'userId',
                'impressionId', 'timelineId', 'html' ])),
        _.keys(newmeta)
    );

    var update = {
        htmlId: snippet.id,
        parserKey: config.key,
        metadata: newmeta,
        fields: _.keys(newmeta),
        parserName: config.name
    }
    var url = composeURL('result');
    return request
        .postAsync(url, {form: update});
};

function importKey(config) {
    var keyfname = "parsers/parsers-keys.json";
    return fs
        .readFileAsync(keyfname)
        .then(JSON.parse)
        .then(function(fcontent) {
            return _.find(fcontent, {name: config.name});
        })
        .then(function(parserKey) {
            return _.extend(config, parserKey);
        })
        .then(function(config) {
            /* explicit, if is true, repeat the failure, otherwise
             * only the new. if is required to reset a broken parser,
             * mongo-scripts will permit extraordinaty intervention */
            if(config.repeat === 'true') {
                debug("Repeating analysis on previously failure { %s : false }",
                    config.name);
                _.set(config.requirements, config.name, false);
            }
            else
                _.set(config.requirements, config.name, { "$exists" : false });

            return config;
        })
        .catch(function(error) {
            debug("⚠ Failure %s", error);
            debug("⚠  Note run from the root, look for %s\n", keyfname);
            throw new Error(error);
        });
};

function please(config) {
    /* set default values if not specified */
    config.repeat = nconf.get('repeat') || null;
    /* this is parsing concurrency, but the amount retrieved if server side fixed of 5 */
    config.snippetConcurrency = _.parseInt(nconf.get('concurrency')) || 5;

    if(!_.isObject(config.requirements)) {
        throw new Error(
            "Developer, requirements has to be an object and check `repeat`");
    }

    return importKey(config)
        .then(function(xtConfig) {
            return snippetAvailable(xtConfig, 'content')
                .map(function(snippet) {
                    var newmeta = config.implementation(snippet);
                    return commitResult(config, newmeta, snippet);
                }, {concurrency: config.snippetConcurrency});
        });

};


module.exports = {
    please: please
};
