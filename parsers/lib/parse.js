#!/usr/bin/env nodejs
var _ = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var request = Promise.promisifyAll(require('request'));
var cheerio = require('cheerio');
var debug = require('debug')('parse・core');
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
        "since": moment("2016-09-11").toISOString(),
        "until": moment().toISOString(),
        "parserName": config.name,
        "repeat": config.repeat,
        "requirement": _.isNull(config.requirement) ?{} :config.requirement
    };
    if(what === 'content')
        requestpayload.amount = config.limit;

    debug("%s %s", url, JSON.stringify(requestpayload, undefined, 2));
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

function commitResult(config, metadata, id) {
    var update = {
        snippetId: id,
        parserKey: config.key,
        metadata: metadata
    }
    var url = composeURL('result');
    return request
        .postAsync(url, {form: update})
        .delay(config.delay);
};

function importKey(config) {
    return fs
        .readFileAsync('parsers/' + config.name+ "-key.json")
        .then(JSON.parse)
        .then(function(fcontent) {
            return _.extend(config, fcontent);
        });
};

function please(config) {
    /* set default values if not specified */
    config.repeat = nconf.get('repeat') || false;
    config.snippetConcurrency = _.parseInt(nconf.get('concurrency') || 1);
    config.limit = _.parseInt(nconf.get('limit') || 40);
    config.delay = _.parseInt(nconf.get('delay') || 200);

    return importKey(config)
        .then(function(config) {
            return snippetAvailable(config, 'status')
                .then(function(numbers) {
                    debug("Snippets ready %d (already parsed %d)",
                        numbers.available, numbers.parsed);
                    config.slots = _.round(numbers.available/config.limit);
                    debug("Going to do %d iteration of %d slots",
                        config.slots, config.limit);
                    return Promise.map(
                        iterateSlots(config),
                        processSnippetSlots,
                        { concurrency: 1 }
                    );
                });
        });
};

function iterateSlots(config) {
    return _.times(config.slots, function(i) {
        return _.extend(config, { index: i });
    });
};

function processSnippetSlots(config) {
    return snippetAvailable(config, 'content')
        .then(function(content) {
            debug("Processing %d entries to be parsed (%d remaining)",
                _.size(content.snippets), content.remaining);
            return content.snippets;
        })
        .map(function(snippet) {
            var metadata = {};
            metadata[config.name] = config.implementation(snippet);
            return commitResult(config, metadata, snippet.id);
        }, {concurrency: config.snippetConcurrency});
};


module.exports = {
    please: please
};
