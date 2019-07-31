#!/usr/bin/env node
var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('bin:mirrorer');
var request = Promise.promisifyAll(require('request'));
var nconf = require('nconf');

nconf.argv().env();

if(!nconf.get('key'))
    return console.log("--password required");

const source = nconf.get('source') || 'https://collector.facebook.tracking.exposed';
const sourceUrl = `${source}/api/v1/mirror/${nconf.get('key')}/`;
const dest = nconf.get('dest') || 'http://localhost:8100';
const destUrl = `${dest}/api/v1/events`;

debug("Fetching latest samples via %s", sourceUrl);
return request
    .getAsync({url: sourceUrl, rejectUnauthorized: false } )
    .then(function(res) {
        return res.body;
    })
    .then(JSON.parse)
    .then(function(e) {
        if(!e.content)
            process.exit(0);
        debug("Extracted %d elements", e.elements);
        return e.content;
    })
    .map(function(copiedReq) {
        debugger;
        return request
            .postAsync(destUrl, { json: copiedReq.body, headers: copiedReq.headers })
            .then(function(result) {
                if(result.body && result.body.status == 'OK')
                    debug("OK %s: %s", copiedReq.headers['x-fbtrex-version'], result.body.info);
                else
                    debug("?? %s - %s", copiedReq.headers['x-fbtrex-version'], result.body);
            })
    }, { concurrency: 1})
    .catch(function(error) {
        debug("――― [E] %s", error.message);
    });
