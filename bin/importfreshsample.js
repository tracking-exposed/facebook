#!/usr/bin/env node
var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('bin:importfreshsample');
var request = Promise.promisifyAll(require('request'));
var nconf = require('nconf');
var mongo = require('../lib/mongo');

nconf.argv().env().file({ file: "config/collector.json" });

var url = ( nconf.get('server') || 'http://localhost:8000' ) + '/api/v1/glue/' + nconf.get('password') +'/20';
const htmlCleanFields = ['_id', 'savingTime', 'id', 'userId', 'impressionId', 'timelineId', 'html' ];

debug("Accessing to %s", url);
return request
    .getAsync(url)
    .then(function(res) {
        return res.body;
    })
    .then(JSON.parse)
    .then(function(content) {

        debug("Returning the timeline of %s %s, impressions %d, htmls %d",
            content[2].startTime,
            moment.duration(moment(content[2].startTime) - moment()).humanize(),
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

        debug("Writing a timeline with %d impressions and %d htmls",
            _.size(impressions), _.size(htmls));

        debugger;
        return Promise.all([
            mongo.writeOne(nconf.get('schema').timelines, timeline),
            mongo.writeMany(nconf.get('schema').impressions, impressions),
            mongo.writeMany(nconf.get('schema').htmls, htmls)
        ]);
    })
    .then(function(done)  {
        debug("Success!");
    });
