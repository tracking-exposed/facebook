#!/usr/bin/env nodejs
var _ = require('lodash');
var Promise = require('bluebird');
var util = require('util');
var fs = Promise.promisifyAll(require('fs'));
var request = Promise.promisifyAll(require('request'));
var debug = require('debug')('tryAPI');
var nconf = require('nconf')

nconf.argv().env();

if ( _.isUndefined(nconf.get('DEBUG')) || 
     _.isUndefined(nconf.get('url')) ) {
    console.log("Set 'DEBUG' env variable and 'url' ");
    return -1;
}

var version = 2;
var url = nconf.get('url');
var userId = nconf.get('userId');
var kind = nconf.get('kind');
var pickedO = null;

/* this is the utilty for all the connection */
var apiR = function(base, api) {
    var URL = base + api;
    debug("POST ⇒ %s", URL);
    return request
        .postAsync(URL, {form: {type: 'artist'}})
        .then(function(response) {
            return JSON.parse(response.body);
        })
        .tap(function(infos) {
            debug("Retrieved %s", URL);
            var toPrint = nconf.get('print');
            _.each(api, function(de) {
                if(de === toPrint)
                    console.log(JSON.stringify(infos, undefined, 2));
            });
        })
        .catch(function(error) {
            debug("!Error with %s: %s", URL, error);
        });
};


if(_.isUndefined(kind)) {
    debug("kind of output: JSON");
    kind = 'public';
}

/* This is the beginning of everything */
return apiR('http://localhost:8000/api/v1', '/events')
    .tap(function(x) {
        console.log("Done!");
    });
