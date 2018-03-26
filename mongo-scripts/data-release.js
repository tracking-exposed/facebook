#!/usr/bin/env nodejs
/*
 * this script pick the information from the database and create a JSON file, which
 * and represent the official opendata extraction tool.
 *
 * it connects to the database of fbtrex
 */

var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('data-release-1');
var daydebug = require('debug')('+');
var moment = require('moment');
var nconf = require('nconf');
var path = require('path');

var mongo = require('../lib/mongo');
var various = require('../lib/various');

var cfgFile = "config/settings.json";
nconf.argv().env().file({ file: cfgFile });

var TRANSLATE = {
    'Destra': 'right',
    'Fascistoidi': 'far-right',
    'Sinistra': 'left',
    'Centro Sinistra': 'center-left',
    'non orientato': 'undecided',
    'M5S': 'M5S'
};

/* loading input options */
var destCollection = nconf.get('dest');
var campaignPath = nconf.get('campaignPath');
var tagId = nconf.get('tagId');
var beginSince = nconf.get('beginSince');
var timeZone = _.parseInt(nconf.get('TZ'));

var FORCEWRITE = !_.isUndefined(nconf.get('FORCEWRITE'));
FORCEWRITE ? debug("Overwrite ON") : debug("FORCEWRITE disable");

function getTimelineCount(filter) {
    return Promise.all([
        mongo.countByMatch(nconf.get('schema').timelines, filter),
        mongo.readLimit(nconf.get('schema').timelines, filter, { startTime: 1 }, 1, 0),
        mongo.readLimit(nconf.get('schema').timelines, filter, { startTime: -1 }, 1, 0),
        mongo.distinct(nconf.get('schema').timelines, 'userId', filter)
    ])
    .then(function(mixed) {
        var begin = beginSince ? moment(beginSince) : moment(mixed[1][0].startTime);
        var end = moment(mixed[2][0].startTime);
        var duration = moment.duration(end - begin);
        var info = {
            count: mixed[0],
            first: begin.format(),
            last: mixed[2][0].startTime,
            days: _.round(duration.asDays()) + 1,
            userList: mixed[3]
        };
        debug("Counting timelines by %j: %d entries. Using as first date %s, last %s %d days (%s)",
                filter, info.count, info.first, info.last, info.days, duration.humanize());
        return info;
    });
};

function processTheDay(direction, i) {
    daydebug("%d\tProcessing day %s", i+1, direction.when);
    return mongo
        .read(nconf.get('schema').htmls, direction.filter, { savingTime: 1 })
        .map(function(html) {

            return mongo
                .read(nconf.get('schema').impressions, { id: html.impressionId })
                .then(_.first)
                .then(function(impression) {

                    if(html.type != 'feed')
                        return null;

                    if(impression.visibility != 'public')
                        return null;

                    if(!html.permaLink || !html.publicationUTime)
                        return null;

                    var publicationMoment = moment( ( html.publicationUTime - timeZone ) * 1000);
                    var produced = {
                        impressionOrder: impression.impressionOrder,
                        impressionTime: impression.impressionTime,
                        profileName: _.find(direction.users, { id: _.toString(html.userId) }).name,
                        profileAlign: TRANSLATE[_.find(direction.users, { id: _.toString(html.userId) }).orientamento],
                        publicationTime: publicationMoment.toISOString(),
                        visualizationDiff: moment
                            .duration(moment(impression.impressionTime) - publicationMoment).asSeconds(),
                        postId: html.postId,
                        utype: html.hrefType,
                        displayName: html.source,
                        externals: html.feedHref ? _.size(html.externalHref) : 0,
                        timelineId: html.timelineId,
                        permaLink: html.permaLink,
                        rtotal: html.rtotal,
                        id: html.id,
                        by: "fbtrex"
                    };

                    var fbreference = html.permaLink.match(/permalink/) ?
                        html.permaLink.replace(/.*id=/, '') : html.permaLink.split('/')[1];

                    var pageInfo = _.find(direction.pages, function(p) { return _.endsWith(p.pageURL, fbreference); });

                    if(pageInfo) {
                        produced.publisherName = pageInfo.displayName;
                        produced.publisherOrientation = TRANSLATE[pageInfo.orientamento];
                    } else {
                        debug("ID %s (%s) permaLink %s rejected", html.id, produced.profileName, html.permaLink);
                        return null;
                    }
                    return produced;
                })
                .catch(function(error) {
                    debug("Error managed in HTML+impression parsing: %s", error.message);
                    debug("%s", JSON.stringify(_.omit(html, ['body', '_id']), undefined, 2));
                });
        }, { concurrency: 1 })
        .then(function(processed) {
            var returnable = _.compact(processed);
            debug("¹ day %s processed %d, produced %d\t\t-%d",
                direction.when, _.size(returnable), _.size(processed), _.size(processed) - _.size(returnable)
            );
            return returnable;
        })
        .then(function(entries) {
            return _.sortBy(entries, function(e) { return moment(e.impressionTime); }).reverse();
        })
        .map(function(entry) {
            return mongo
                .countByMatch(destCollection, {
                    postId: entry.postId,
                    profileName: entry.profileName,
                    id: { "$ne": entry.id } 
                })
                .then(function(count) {
                    entry.observed = (count + 1);
                    return mongo
                        .writeOne(destCollection, entry)
                        .return(true)
                        .catch(function(error) {
                            if(error.code !== 11000) /* E11000 duplicate key error collection */ {
                                debug("Error in writeOne: %s", error.message);
                                debugger;
                            }
                            else
                                if(FORCEWRITE)
                                    return overwrite(entry);
                            return null;
                        });
                })
                .delay(10);
                /* why? just trying because of:
                 * failed to connect to server [localhost:27017] on first connect */
        }, { concurrency: 1} )
        .then(function(addressed) {
            var saved = _.compact(addressed);
            debug("² day %s addressed %d, saved %d\t\t-%d",
                direction.when, _.size(addressed), _.size(saved), _.size(addressed) - _.size(saved)
            );
            direction.saved = _.size(saved);
            return direction;
        })
};


if(!destCollection || !campaignPath || !tagId || !timeZone) {
    debug("Mandatory option miss:");
    console.log("dest\t\t\tmongodb dest collection");
    console.log("tagId\t\t\tcontrol group");
    console.log("campaignPath\t\t/home/storyteller/invi.sible.link/campaign/$name");
    console.log("TZ\t\t\tnumber of seconds to be -subtract from publicationUTime (GMT)");
    process.exit(1);
}

return Promise.all([
        /* XXX note this is campaign dependent */
        various.loadJSONfile(path.join(campaignPath, 'fonti', 'pagine-exp1.json')),
        various.loadJSONfile(path.join(campaignPath, 'fonti', 'utenti-exp1.json')),
        various.loadJSONfile(path.join('config', 'italy-2018.json')),
        getTimelineCount({tagId: tagId})
    ])
    .then(function(mixed) {
        var info = _.last(mixed);
        // TODO sistema i dati in modo che siano utili all'attribution dopo
        if(mixed[2] && mixed[2].users) {
            if( _.size(info.userList) !== _.size(mixed[2].users))
                debug("Odd: the users declared are different from the users observe");
        }
        if(!(mixed[2] && mixed[2].users)) {
            debug("if the users shall be configured by a file or by users self-declaration: it depends!");
            console.log("At the moment having a campaign it is necessary!");
            process.exit(1);
        }
        info.users = _.map(mixed[2].users, function(u) {
            u.orientamento = _.find(mixed[1], { bot: u.name }).orientamento;
            return u;
        });
        info.pages = mixed[0];
        return info;
    })
    .tap(function(info) {
        return Promise.all([
                mongo.createIndex(destCollection, { id: 1 }, { unique: true }),
                mongo.createIndex(destCollection, { postId: 1 }),
                mongo.createIndex(destCollection, { userId: 1 }),
                mongo.createIndex(destCollection, { impressionTime: 1 })
        ]);
        debug("Created destination collection %s and the indexes", destCollection);
    })
    .then(function(info) {
        return _.times(info.days, function(dayOffset) {
            var beginStr = moment(info.first).add(dayOffset, 'd').format("YYYY-MM-DD");
            var endStr = moment(info.first).add(dayOffset+1, 'd').format("YYYY-MM-DD");

            return {
                'filter': {
                    'savingTime': {
                        '$gte': new Date(beginStr),
                        '$lt': new Date(endStr)
                    },
                    'userId': {
                        '$in': _.map(info.users, 'id').map(_.parseInt)
                    },
                },
                'users': info.users,
                'pages': info.pages,
                'when': beginStr
            };
        });
    })
    .each(processTheDay)
    .tap(function(results) {
        debug("Done: %d days processed", _.size(results));
    });
