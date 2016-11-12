#!/usr/bin/env nodejs
var _ = require('lodash');
var Promise = require('bluebird');
var util = require('util');
var fs = Promise.promisifyAll(require('fs'));
var request = Promise.promisifyAll(require('request'));
var cheerio = require('cheerio');
var debug = require('debug')('parserTest');
var moment = require('moment');
var nconf = require('nconf');

nconf.argv().env();

if ( _.isUndefined(nconf.get('DEBUG')) || 
     _.isUndefined(nconf.get('url')) ) {
    console.log("Set 'DEBUG' env variable and 'url' ");
    return -1;
}

/*
 *  /snippet/status
 *  /snippet/content
 *  /snippet/result     */

function composeURL(what) {
    return [ nconf.get('url'), 'api', 'v1', 'snippet', what ].join('/');
};

function snippetActivity(what) {
    var url = composeURL(what);
    debug("⇒ %s", url);
    var content = {
            "since": moment().subtract(2, 'd').toISOString(),
            "until": moment().toISOString(),
            "parserName": "postType",
            "requirement": {}
    };
    if(what === 'content') {
        content.amount = 12;
        debug("limit the query to %s", content.amount);
    }
    debug("Sending %s", JSON.stringify(content, undefined, 2));
    return request
        .postAsync(url, {form: content })
        .then(function(response) {
            return JSON.parse(response.body);
        })
        .tap(function(infos) {
            // console.log(JSON.stringify(infos, undefined, 2));
        })
        .catch(function(error) {
            debug("Error with %s: %s", url, error);
        });
};

function snippetResult(parserName, metadata, id) {
    var update = {
        snippetId: id,
        parserName: parserName,
        parserKey: "msddskcsdfpsdfdskfopdskfopsdfpodk",
        result: metadata
    }
    var url = composeURL('result');
    return request
        .postAsync(url, {form: update});
};

function isPromoted(htmlblock) {
    var $ = cheerio.load(htmlblock);
    return $('.uiStreamSponsoredLink').length > 0;
};

/* This is the beginning of everything */
return snippetActivity('status')
    .then(function(result) {
        return snippetActivity('content')
    })
    .then(function(content) {
        debug("Processing %d entries to be parsed",
            _.size(content.snippets));
        return content.snippets;
    })
    .map(function(snippet) {
        var type = isPromoted(snippet.html) ? "promoted" : "feed";
        debug("type = %j", type);
        return snippetResult('postType', type, snippet.id);
    });
