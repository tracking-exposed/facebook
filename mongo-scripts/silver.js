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
var debug = require('debug')('silver');
var moment = require('moment');
var nconf = require('nconf');
var fs = Promise.promisifyAll(require('fs'));

var utils = require('../lib/utils');
var mongo = require('../lib/mongo');
var various = require('../lib/various');

var cfgFile = "config/settings.json";
nconf.argv().env().file({ file: cfgFile });

if(!(nconf.get("STARTDAY") || nconf.get("ENDDAY") || nconf.get("TIMEF") || nconf.get("HTMLF"))) {
    console.log("STARTDAY, ENDDAY, TIMEF (timeline), HTMLF");
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
        }),
	timeline.name
    ])

    .then(function(combos) {

	debug("htmls %d, impressions %d, %s timeline %s of %s",
		_.size(combos[0]), _.size(combos[1]), combos[2],
		timeline.startTime, timeline.name);

        return _.map(combos[1], function(impression, i) {
            var html = _.find(combos[0], { id: impression.htmlId });

            if(html) {
		    if(html.permaLink) {
			if(html.hrefType === "groupPost")
			    html.sourceId = html.permaLink.split('/')[2];
			else
			    html.sourceId = html.permaLink.split('/')[1];
		    }
		var ret = impression;
		    ret.name = combos[2];
		    ret.geoip = timeline.geoip;
		    ret.publicationTime = moment(html.publicationUTime * 1000);
                return _.merge(
                    _.omit(ret, ['_id', 'id', 'htmlId' ]),
                    _.omit(html, ['_id', 'html', 'impressionId', 'postType',
                                  'publicationUTime', 'feedUTime', 'type',
                                  'feedText', 'feedHref', 'feedBasicInfo',
                                  'imageAltText', 'savingTime' ])
		);
	    } else {
	        impression.name = combos[2];
                return _.omit(impression, ['_id', 'id', 'htmlId' ])
	    }
        });
    })
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

function beginQuery(user) {

    debug("User %j", user);
    var filter = _.extend(timef, {
        startTime: {
            "$gt": new Date(timeFilter.start),
            "$lt": new Date(timeFilter.end) 
        },
        "nonfeed": { "$exists": false },
        userId: _.parseInt(user.id)
    });
   
    debug("%j", filter); 
    return mongo
	.read(nconf.get('schema').timelines, filter, { startTime: -1 })
	.map(function(e, i) {
	    debug("%d %s %s %s %s", i, e.id, user.name, moment(e.startTime).format("DD HH:mm"), e.geoip);
	    e.name = user.name;
	    return e;
	})
    	.map(lookintoHTMLs, { concurrency: 1 });
};

return various
    .loadJSONfile("config/users.json")
    .tap(function(users) {
        debug("Creating file");
        return appendPromise(destFile, "[\n", true);
    })
    .then(function(c) {
        return c['silver'];
    })
    .map(beginQuery, { concurrency: 1})
    .tap(function() {
        return appendPromise(destFile, "]");
        debug("Complete! remind to delete the last comma of: %s", destFile);
    });
