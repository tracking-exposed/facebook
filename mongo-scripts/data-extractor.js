#!/usr/bin/env nodejs
/* this is a script intended to extract section of the dataset
 * to feed analysis tool like tableau.
 *
 * Environment variable:
 *
 * STARTDAY YYYY-MM-DD 
 * ENDDAY YYYY-MM-DD
 * TIMEF,
 * HTMLF
 * concurrency 
 * */

var _ = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('data-extractor');
var moment = require('moment');
var nconf = require('nconf');
var fs = Promise.promisifyAll(require('fs'));

var utils = require('../lib/utils');
var mongo = require('../lib/mongo');

var cfgFile = "config/settings.json";
nconf.argv().env().file({ file: cfgFile });


if(!(nconf.get("STARTDAY") || nconf.get("ENDDAY") || nconf.get("TIMEF") || nconf.get("HTMLF"))) {
    console.log("STARTDAY, ENDDAY, TIMEF (timeline), HTMLF, [pattern]");
    process.exit(1);
}

var timeFilter = { 
    start: moment(nconf.get('STARTDAY')),
    end: moment(nconf.get('ENDDAY'))
}

var timediff = moment.duration(timeFilter.end - timeFilter.start);
var destFile = "extracted-" + timediff.humanize() + ".json";

var timef = nconf.get('TIMEF') || '{}';
timef = JSON.parse(timef);
var htmlf = nconf.get('HTMLF') || '{}';
htmlf = JSON.parse(htmlf);
var pattern = nconf.get('pattern') || null;

debug("Executing timewindow: %s %s timeline filter %s, htmls filter %s +feed only",
    JSON.stringify(timeFilter, undefined, 2),
    timediff.humanize(),
    JSON.stringify(timef, undefined, 2),
    JSON.stringify(htmlf, undefined, 2) );

function lookintoHTMLs(timeline, counter) {

    return Promise.all([
        mongo.read(nconf.get('schema').htmls, {
            timelineId: timeline.id,
            type: 'feed'
        }),
        mongo.read(nconf.get('schema').impressions, {
            timelineId: timeline.id
        })
    ])
    .then(function(combos) {

        if((counter % 100) === 0)
            debug("Timelines before end: %d", counter);

        if(pattern)
            var re = new RegExp(pattern, 'i');

        return _.map(combos[0], function(html, i) {
            var x = _.find(combos[1], { htmlId: html.id });

            if(!x) return null;

            if(html.permaLink) {
                if(html.hrefType === "groupPost")
                    x.sourceId = html.permaLink.split('/')[2];
                else
                    x.sourceId = html.permaLink.split('/')[1];
            }

            if(pattern) {
                var bool = html.html.match(re) ? true: false;
                _.set(x, pattern, bool);
            }

            x.geoip = timeline.geoip;
            x.publicationTime = moment(html.publicationUTime * 1000);

            return _.merge(
                _.omit(x, ['_id', 'id', 'visibility', 'htmlId' ]),
                _.omit(html, ['_id', 'html', 'impressionId', 'postType',
                              'publicationUTime', 'feedUTime', 'type',
                              'feedText', 'feedHref', 'feedBasicInfo',
                              'imageAltText', 'savingTime' ])
            );
        });
    })
    .then(_.compact)
    .then(function(content) {

        var str = _.reduce(content, function(memo, elem) {
            if(memo !== "")
                memo += ",\n";

            memo += JSON.stringify(elem, undefined, 2);
            return memo;
        }, "");

        if(str !== "")
            return appendPromise(destFile, str + ",\n");
    });

}

function appendPromise(fpath, str, reset=false) {
    var options = {
        encoding: 'utf8',
        mode: 0666,
        flag: 'a' 
    };
    if(reset) {
        debug("Opening and eventually overwritting '%s'", fpath);
        options.flag = "w";
    }
    return fs
        .writeFileAsync(fpath, str, options)
        .catch(function(error) { 
            debug("Error in %s: %s", fpath, error);
            return false;
        });
}

function beginQuery() {

    var filter = _.extend(timef, {
        startTime: {
            "$gt": new Date(timeFilter.start),
            "$lt": new Date(timeFilter.end) 
        },
        "nonfeed": { "$exists": false }
    });
    
    return mongo
        .read(nconf.get('schema').timelines, filter, { startTime: -1 })
        .tap(function(tmls) {
            debug("processing %d timelines", _.size(tmls));
            return appendPromise(destFile, "[\n", true);
        })
};

return beginQuery()
    .map(lookintoHTMLs, { concurrency: 1 })
    /* concurrency has to be 1 because there is an hack-on-filesystem */
    .tap(function() {
        return appendPromise(destFile, "]");
        debug("Complete! output in %s", destFile);
    });

