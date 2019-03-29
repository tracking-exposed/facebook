#!/usr/bin/env node
var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('bin:importfreshsample');
var reportDuplicate = require('debug')('bin:importfreshsample:duplicate!');
var request = Promise.promisifyAll(require('request'));
var nconf = require('nconf');
var mongo = require('../lib/mongo');

nconf.argv().env();
const cfgFile = nconf.get('config') ? nconf.get('config') : "config/content.json";
nconf.file({ file: cfgFile });

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
        });

        var htmls = _.map(content[1], function(h) {
            var clean = _.pick(h, htmlCleanFields);
            clean.savingTime = new Date(clean.savingTime);
            return clean;
        });

        if(!_.size(htmls) || !_.size(impressions)) {
            debug("Found an empty timeline! (%s) nothing to save.", content[2].id);
            return [ null, [], [] ];
        }

        debug("Ready with a timeline with %d impressions and %d htmls",
            _.size(impressions), _.size(htmls));

        /* because one writing operation might fail for duplicated Id the operation are separated */

        return [ timeline, impressions, htmls ];
    })
    .tap(writeTimeline)
    .tap(writeImpressions)
    .tap(updateSupporter)
    .then(writeHtmls)
    .map(function(done)  {
        if(_.get(done, 'id'))
            console.log(done.id);
    });

function writeTimeline(blob) { 
    if(blob[0] && _.get(blob[0], 'id')) {
        return mongo
            .writeOne(nconf.get('schema').timelines, blob[0])
            .catch(duplicatedError);
    }
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
        if(_.size(blob[1])) {
            if(!counter)
                reportDuplicate("timeline already saved");
            else 
                debug("Written %d impressions", counter);
        }
    });
}

function writeHtmls(blob) { 
    return Promise.map(blob[2], function(html) {
        /* this and updateSupporter, permits to run the test with bin/parserv.js */
        html.savingTime = new Date();
        return mongo
            .writeOne(nconf.get('schema').htmls, html)
            .catch(duplicatedError);
    }, { concurrency: 1} );
}

function duplicatedError(error) { 
    if(error.code !== 11000) {
        debug("unexpected error?\n%s", error.message);
        process.exit(0);
    }
}

function updateSupporter(blob) {
    if(blob[0]) {
        var userId = blob[0].userId;
        return mongo
            .readOne(nconf.get('schema').supporters, { userId: userId })
            .then(function(found) {
                if(!found) found = { userId };
                return _.set(found, 'lastActivity', new Date());
            })
            .then(function(updated) {
                return mongo
                    .upsertOne(nconf.get('schema').supporters, { userId: updated.userId }, updated);
            });
    };
};
