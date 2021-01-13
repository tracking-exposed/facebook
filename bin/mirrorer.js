#!/usr/bin/env node
const _ = require('lodash');
const Promise = require('bluebird');
const debug = require('debug')('fbtrex:mirrorer');
const request = Promise.promisifyAll(require('request'));
const moment = require('moment');
const nconf = require('nconf');

nconf.argv().env();

if(!nconf.get('key'))
    return console.log("--key required");

const source = nconf.get('source') || 'https://collector.facebook.tracking.exposed';
const sourceUrl = `${source}/api/v1/mirror/${nconf.get('key')}/`;
const dest = nconf.get('dest') || 'http://localhost:8100';
const destUrl = `${dest}/api/v1/events`;

debug("Fetching latest samples via %s", sourceUrl);
return request
    .getAsync({url: sourceUrl, rejectUnauthorized: false } )
    .then(function(res) {
        // debug("Download completed (%d)", _.size(res.body) );
        return res.body;
    })
    .then(JSON.parse)
    .then(function(e) {
        if(!e.content)
            process.exit(0);
        // debug("Extracted %d elements", e.elements);
        return e.content;
    })
    .tap(function(copiedReqs) {
        const inf = _.map(copiedReqs, function(c) {
            if(c.body && c.body[0] && c.body[0].startTime)
                return moment.duration(
                    moment(c.body[0].startTime) - moment()
                ).humanize();
            else
                return "∅";
        })
        debug("Timelines saved: %s", inf.join(', '));
    })
    .map(function(copiedReq) {
        return request
            .postAsync(destUrl, { json: copiedReq.body, headers: copiedReq.headers })
            .then(function(result) {
                if(result.body && result.body.status == 'OK') { /* 
                    > result.body.info (3) [{…}, {…}, {…}]
                    > result.body.info[0]
                    {kind: "htmls", amount: 3}
                    > result.body.info[1]
                    {kind: "impressions", amount: 3}
                    > result.body.info[2]
                    {_id: "5e3540ecf26bfd0eecdb4acf", publicKey: "FvviQLBXKXb4ozQzKRjFZ85TTQAjncYjBjWW6jpSfngW", keyTime: "2020-02-01T09:12:12.244Z", lastActivity: "2020-02-01T09:50:43.172Z", version: "2.0.0", …}
                    > result.body.info[2].pseudo
                    "okra-ravioli-tapioca" */
                    debug("OK %s:\t%s\t%j", copiedReq.headers['x-fbtrex-version'], 
                        _.last(result.body.info).pseudo ? _.last(result.body.info).pseudo : 'pseudo:N/A',
                        result.body.info[0]);
                }
                else
                    debug("?? %s - %s", copiedReq.headers['x-fbtrex-version'], result.body);
            })
    }, { concurrency: 1})
    .catch(function(error) {
        debug("――― [E] %s", error.message);
    });
