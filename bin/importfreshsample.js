#!/usr/bin/env node
var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('bin:importfreshsample');
var request = Promise.promisifyAll(require('request'));
var nconf = require('nconf');
var mongo = require('../lib/mongo');

nconf.argv().env().file({ file: "config/collector.json" });

if(!nconf.get('password'))
    return console.log("--password required");

const amount = nconf.get('amount') || 50;
const url = ( nconf.get('server') || 'http://localhost:8000' ) + '/api/v1/glue/' + nconf.get('password') +'/' + amount;

const htmlCleanFields = ['_id', 'savingTime', 'id', 'userId', 'impressionId', 'timelineId', 'html' ];

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

        var timeline = content[2];
        timeline.startTime = new Date(content[2].startTime);

        var impressions = _.map(content[0], function(i) {
            i.impressionTime = new Date(i.impressionTime);
            return i;
        }) || [];

        var htmls = _.map(content[1], function(h) {
            var clean = _.pick(h, htmlCleanFields);
            clean.savingTime = new Date(clean.savingTime);
            return clean;
        }) || [];

        if(!_.size(htmls)) {
            debug("Found an empty timeline! (%s) nothing to save.", content[2].id);
            return [];
        }

        debug("Ready with a timeline with %d impressions and %d htmls",
            _.size(impressions), _.size(htmls));

        /* because one writing operation might fail for duplicated Id the operation are separated */

        return [ timeline, impressions, htmls ];
    })
    .tap(writeTimeline)
    .tap(writeImpressions)
    .then(writeHtmls)
    .then(_.compact)
    .map(function(done)  {
        console.log(done.id);
    });

function writeTimeline(blob) { 
    if(blob[0] && _.get(blob[0], 'id'))
        return mongo
            .writeOne(nconf.get('schema').timelines, blob[0])
            .catch(duplicatedError);
}

function writeImpressions(blob) {
    var counter = 0;
    return Promise.map(blob[1], function(impression) {
        return mongo
            .writeOne(nconf.get('schema').impressions, impression)
            .tap(function() { counter++; })
            .catch(duplicatedError);
    }, { concurrency: 1} )
    .tap(function() {
        debug("Written %d impressions", counter);
    });
}

function writeHtmls(blob) { 
    return Promise.map(blob[2], function(html) {
        return mongo
            .writeOne(nconf.get('schema').htmls, html)
            .catch(duplicatedError);
    }, { concurrency: 1} );
}

function duplicatedError(error) { 
    if(error.code === 11000)
        debug("entry duplicated, copy continue in search of new impressions");
    else {
        debug("unexpected error?\n%s", error.message);
        process.exit(0);
    }
}
