#!/usr/bin/env node
const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');
const debug = require('debug')('bin:importfreshsample');
const reportDuplicate = require('debug')('bin:importfreshsample:duplicate!');
const request = Promise.promisifyAll(require('request'));
const nconf = require('nconf');

const mongo = require('../lib/mongo');
const glue = require('../lib/glue');

nconf.argv().env();
const cfgFile = nconf.get('config') ? nconf.get('config') : "config/content.json";
nconf.file({ file: cfgFile });

if(!nconf.get('password'))
    return console.log("--password required");

const amount = nconf.get('amount') || 50;
const url = ( nconf.get('server') || 'http://localhost:8000' ) + '/api/v1/glue/' + nconf.get('password') +'/' + amount;

debug("Accessing to %s", url);
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
    });
