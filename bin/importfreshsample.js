#!/usr/bin/env node
const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');
const debug = require('debug')('bin:importfreshsample');
const request = Promise.promisifyAll(require('request'));
const nconf = require('nconf');

const glue = require('../lib/glue');

nconf.argv().env();
const cfgFile = nconf.get('config') ? nconf.get('config') : "config/content.json";
nconf.file({ file: cfgFile });

if(!nconf.get('password'))
    return console.log("--password required");

const samplesize = nconf.get('samplesize') || 500;

const server = nconf.get('server') || 'http://localhost:8000';
const url = `${server}/api/v2/debug/exporter/${nconf.get('password')}/${samplesize}`;

debug("API version %d: accessing to %s sample size %d", version, url, samplesize);
return request
    .getAsync(url)
    .then(function(res) {
        return res.body;
    })
    .then(JSON.parse)
    .then(function(content) {

        debug("Returning the timeline %s (%s %s) %s, impressions %d, htmls %d",
            content[2].id,
            content[2].startTime,
            moment.duration(moment(content[2].startTime) - moment()).humanize(),
            content[2].geoip,
            _.size(content[0]),
            _.size(content[1])
        );

        return glue.importer(content);
    })
    .then(glue.writers)
    .map(function(done)  {
        if(_.get(done, 'id'))
            console.log(done.id);
    })
    .catch(function(error) {
        debug("――― [E] %s", error.message);
    });
