#!/usr/bin/env nodejs
var _ = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('realityreduction');
var moment = require('moment');
var nconf = require('nconf');

var utils = require('../lib/utils');
var mongo = require('../lib/mongo');
var timutils = require('../lib/timeutils');

var cfgFile = "config/settings.json";
nconf.argv().env().file({ file: cfgFile });

/*
 * This batch produce (many, potentially updating) entries for one collection:
 *   `reality`: chronologically ordered postId list, with accessory data used by postId
 * 
 * TODO update has to be done on the collection: 
 *   `perception`: timeline with medatada expanded. This collection would be the chronological
 *                 perception of the users, maybe would be already aggregated, for example with
 *                 semantic analysis of the content processed
 */

if(!_.parseInt(nconf.get('DAYS')))
    throw new Error("DAYS is required, specifiy the start-until window of time");

var timeFilter = timutils.doFilter(
        nconf.get('HOURSAFTER'), 
        nconf.get('DAYSAGO'), 
        nconf.get('HOURSAGO'), 
        _.parseInt(nconf.get('DAYS')), 'd'
    );

var keys = [
    'id',
    'userPseudo',
    'publicationUTime',
    'impressionTime',
    'impressionOrder',
    'postId',
    'permaLink',
    'timelineId',
    'counter'
];

debug("Executing timewindow: %s and nation",
    timutils.prettify(timeFilter));

function getRelativeInfo(htmlId) {

    var sequence = {
        $lookup: {
            from: nconf.get('schema').timelines,
            localField: 'timelineId',
            foreignField: 'id',
            as: "timeline"
         }
    };

    return mongo
        .lookup(nconf.get('schema').impressions, { $match: { htmlId: htmlId }}, sequence)
        .then(_.first)
        .then(function(c) {
            var f = _.pick(c, [ 'timelineId', 'userId', 'impressionOrder', 'impressionTime' ]);
            var s = _.pick(c.timeline[0], [ 'geoip', 'startTime' ]);
            return _.extend(f, s);
        })
        .catch(function(error) {
            debug("Error: %s %s", error, htmlId);
        });
    ;
};


function getExisting(postId) {

    return mongo
        .read(nconf.get('schema').reality, { postId: postId })
        .then(_.first)
        .catch(function(error) {
            debug("Error getExisting: %s %s %j", error, htmlId, sequence);
        });
};

function getMetadata(present, html) {
    var now = _.omit(html, ['_id', 'publicationUTime', 'savingTime', 'id', 
                            'userId', 'impressionId', 'timelineId', 'html', 'postId',
                            /* and parsers meta-results ... */ 
                            'postType', 'feedUTime' ]);

    if(_.size(_.keys(now)) < _.size(_.keys(present))) {
        debug("Strange situation, returning %j instead of %j", present, now);
        return present;
    }
    return now;
};

function reality(html, i, x) {

    /* here we take the postId, we're to check for every postId if is already in the DB 
     * and update the entry or upsert.
     *
     * postId is an index and is unique 
     */

    return Promise
        .all([ getRelativeInfo(html.id), getExisting(html.postId) ])
        .then(function(infos) {
            var related = infos[0];
            var existent = infos[1];

            /* debug("related %s", JSON.stringify(related, undefined, 2));
            debug("existent %s", JSON.stringify(existent, undefined, 2)); */

            if(!existent) {
                debug("%d/%d ++ %s userId %s postId %s", i, x, html.savingTime, html.userId, html.postId);
                existent = { 'postId': _.toString(html.postId), 'publicationUTime': html.publicationUTime, timelines: [] };
            }
            else if(_.find(existent.timelines, {id: related.timelineId })) {
                debug("%d/%d --- Present, skip %s", i,x, html.id);
                return true;
            }

            existent.metadata = getMetadata(existent.metadata, html);
            existent.timelines.push({
                'id': related.timelineId,
                'impressionTime': new Date(related.impressionTime),
                'impressionOrder': related.impressionOrder,
                'startTime': new Date(related.startTime),
                'geoip': related.geoip,
                'userPseudo' : utils.numId2Words([ _.parseInt(existent.postId), related.userId])
            });

            if( existent.publicationUTime != html.publicationUTime )
                debug("Strange: %d %d %d", 
                    _.parseInt(existent.publicationUTime),
                    _.parseInt(html.publicationUTime),
                    _.parseInt(existent.publicationUTime) - _.parseInt(html.publicationUTime) );

            if(!existent.publicationTime)
                existent.publicationTime = new Date(moment(html.publicationUTime * 1000).toISOString());

            var t = _.countBy(existent.timelines, 'userPseudo');
            if(_.size(t) > 2)
                debug("someone new: %s", JSON.stringify(t, undefined, 2));

            return mongo
                .updateOne(nconf.get('schema').reality, {postId: existent.postId}, existent )
                .then(function(result) {
                    return true;
                })
                .catch(function(error) {
                    debug("Error: %j", error);
                    return false;
                });
        });


}

function getHTMLs(previous, blockSize) {

    var filter = { 
        postId: { "$exists": true },
        publicationUTime: { "$exists": true },
        savingTime: {
            "$gt": new Date(timeFilter.start),
            "$lt": new Date(timeFilter.end)
        }
    };

    if(!previous)
        previous = 0;
    debug("Selecting timelines as: %s previously read %d blockSize %d",
        JSON.stringify(filter, undefined, 2), previous, blockSize);

    return mongo
        .readLimit(nconf.get('schema').htmls, filter, {}, blockSize, previous);
};

function saveReality(previous, blockSize) {

    debug("Iterating over a %d block skipping %d", blockSize, previous);
    return getHTMLs(previous, blockSize)
        .tap(function(htmls) {
            debug("~~ skipping %d block of %d working on %d",
                previous, blockSize, _.size(htmls)); 
        })
        .map(reality, { concurrency: _.parseInt(nconf.get('CONCURRENCY')) || 1 })
        .then(function(results) {
            if(_.size(results) < blockSize) {
                debug("Process completed!");
                return 0;
            } else {
                previous += _.size(results);
                return saveReality(previous, blockSize);
            }
        });
};

return saveReality(_.parseInt('SKIP') || 0, _.parseInt(nconf.get('BLOCK')) || 2000 );
