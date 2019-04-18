const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('lib:glue');
const reportDuplicate = require('debug')('lib:glue:duplicate!');
const nconf = require('nconf');
const Promise = require('bluebird');
const request = Promise.promisifyAll(require('request'));
 
const mongo = require('./mongo');
const params = require('./params');

/* these functions are used in: 
 *  bin/importfreshsample 
 * because it download a random timeline and import in the local db
 *
 * and `parsers/unique` (via lib/parse), because when a requested ID is not found,
 * is downloaded with the function glue.retrive
 *
 * the api is /api/v1/glue/$password/$samplesize
 */

function importer(content) {
    const htmlCleanFields = [ 'savingTime', 'id', 'userId', 
        'impressionId', 'timelineId', 'html' ];

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
        debug("Found an empty timeline! (%s) nothing to save.",
            content[2].id);
        return [ null, [], [] ];
    }
    debug("Ready with a timeline with %d impressions and %d htmls",
        _.size(impressions), _.size(htmls));

    /* because one writing operation might fail for
     * duplicated Id the operation are separated */
    return [ timeline, impressions, htmls ];
}

function writeTimeline(blob) { 
    if(blob[0] && _.get(blob[0], 'id')) {
        return mongo
            .writeOne(nconf.get('schema').timelines, blob[0])
            .catch(duplicatedError)
            .return(blob);
    } else
        throw new Error("Nothing to do here");
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
    })
    .return(blob);
}

function writeHtmls(blob) { 
    return Promise.map(blob[2], function(html) {
        _.unset(html, 'processed');
        /* this hack and updateSupporter, are necessary to make run the test with bin/parserv.js */
        html.savingTime = new Date();
        return mongo
            .writeOne(nconf.get('schema').htmls, html)
            .catch(duplicatedError);
    }, { concurrency: 1} )
    .return(blob);
}

function duplicatedError(error) { 
    if(error.code !== 11000) {
        debug("unexpected error?\n%s", error.message);
        console.log(error.stack);
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

function retrive(htmlfilter) {
    const url = ( nconf.get('server') || 'https://testing.tracking.exposed' ) + '/api/v2/debug/html/' + htmlfilter.id;
    debug("Remotely retrive the HTML content (%s)", url);
    return request
        .getAsync(url)
        .then(function(res) {
            return res.body;
        })
        .then(JSON.parse)
        .then(function(x) {
            debug("Importing the HTML %s (%s | %s) impressionOrder %d",
                x.impression.htmlId,
                moment.duration(moment(x.impression.impressionTime) - moment()).humanize(),
                x.timeline.geoip,
                x.impression.impressionOrder
            );
            return [ x.timeline, [ x.impression ] , [ x.html ] ];
        });
};

function writers(blob) {
    debug("Ready to write %d total bytes", _.size(JSON.stringify(blob)));
    return writeTimeline(blob)
        .tap(writeImpressions)
        .tap(updateSupporter)
        .then(writeHtmls)
        .catch(function(error) {
            debug("Impossible to write: %s", error.message);
        });
};

module.exports = {
    importer: importer,
    writers: writers,
    retrive: retrive
};
