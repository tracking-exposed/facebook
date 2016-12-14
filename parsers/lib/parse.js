#!/usr/bin/env nodejs
var _ = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var request = Promise.promisifyAll(require('request'));
var cheerio = require('cheerio');
var debug = require('debug')('parse⊹core');
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
        "since": nconf.get('since')
            ? moment(nconf.get('since')) : config.since,
        "until": nconf.get('until')
            ? moment(nconf.get('until')) : config.until,
        "parserName": config.name,
        "requirements": config.requirements || {}
    };

    debug("Connect to %s\n%s",
        url, JSON.stringify(requestpayload, undefined, 2));

    return request
        .postAsync(url, {form: requestpayload})
        .then(function(response) {
            return JSON.parse(response.body);
        })
        .catch(function(error) {
            debug("Error with %s: %s", url, error);
            throw new Error(error);
        });
};

function commitResult(config, newmeta, snippet) {
    /* debug("metadata has %s keys newmeta %s",
        _.keys(snippet.metadata), _.keys(newmeta)); */

    var update = {
        snippetId: snippet.id,
        parserKey: config.key,
        metadata: newmeta,
        fields: _.keys(newmeta),
        parserName: config.name
    }
    var url = composeURL('result');
    return request
        .postAsync(url, {form: update})
        .delay(config.delay);
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
            if(_.isNull(config.repeat))
                ;
            else if(config.repeat === 'false')
                _.set(config.requirements, config.name, false);
            else if(config.repeat === 'true')
                _.set(config.requirements, config.name, true);
            else
                throw new Error("config.repeat has an unexpected value");

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
    config.snippetConcurrency = _.parseInt(nconf.get('concurrency')) || 5;
    config.delay = nconf.get('delay') || 200;

    if(!_.isObject(config.requirements)) {
        throw new Error(
            "Developer, requirements has to be {} and pls check `repeat`");
    }

    return importKey(config)
        .then(function(xtConfig) {
            return snippetAvailable(xtConfig, 'status')
                .then(function(numbers) {
                    xtConfig.slots=_.round(numbers.available/numbers.limit);
                    debug("%d HTMLs, %d per request = %d requests",
                        numbers.available, numbers.limit, xtConfig.slots);
                    return Promise.map(
                        iterateSlots(xtConfig),
                        processHTMLbulk,
                        { concurrency: 1 }
                    );
                });
        });
};

function iterateSlots(config) {
    return _.times(config.slots + 1, function(i) {
        return _.extend(config, { index: i });
    });
};

function processHTMLbulk(config) {
    return snippetAvailable(config, 'content')
        .map(function(snippet) {
            var newmeta = config.implementation(snippet);
            return commitResult(config, newmeta, snippet);
        }, {concurrency: config.snippetConcurrency});
};


module.exports = {
    please: please
};
