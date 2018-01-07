/* this method is the service-side implementation of the batch
 * script used to export information after a campaing
 */

var _ = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('reducer');
var moment = require('moment');
var nconf = require('nconf');
var fs = Promise.promisifyAll(require('fs'));

var utils = require('./utils');
var mongo = require('./mongo');
var various = require('./various');

function dateim(hours, defaulth) {
    var hoursm = _.parseInt(hours);
    if(_.isNaN(hoursm))
        hoursm = defaulth;
    var retm = moment
        .startOf('hour')
        .subtract(hoursm, 'h')
        .toISOString();
};

function reducer1(req) {
    /* this function could be a bit CPU-intensive, that's
     * why is password protected */
    var start = dateim(req.params.begin, 2);
    var end = dateim(req.params.end, 0);

    /* temportarly hardcoded, despite can be open to tagId, 
     * in this way I can put presudonym to users instead of userId */
    var USER_SOURCE = "config/italy-2018.json";

    lookForTimelines = _.part(timelineSearch, { start: start, end: end });

    var retVal = { impressions: [], posts: [] };
    return various
        .loadJSONfile(USER_SOURCE)
        .map(lookForTimelines, { concurrency: 1})
        .then(_.flatten)
        .tap(function(c) {
            debug("all the impressions are %d", _.size(c));
            /* saving the file, all the data are kept togheder, but not 'text' */
            var clean = _.map(c, function(o) { return _.omit(o, ['text', 'externals'])});
            retVal.impressions = clean;
        })
        .then(postSequence)
        .tap(function(p) {
            debug("[+] Unique posts are %d", _.size(p));
            /* saving the post, all the data are kept togheder */
            retVal.posts = p;
        })
        .then(function() {
            return { json: retVal };
        });
}


function flattenReactions(rmap) {
    /* `rmap` contains a collections of object like this:  *
       { "label":"1 Love","type":"2","amount":"1"}         *
       or is empty, and we need to provide defauls         */
    var ret = {
        'love': 0,
        'like': 0,
        'sad': 0,
        'haha': 0,
        'wow': 0,
        'angry': 0,
        'thankful': 0,
    };
    _.each(rmap, function(r) {
        switch(r.type) {
            case "1":
                ret.like = _.parseInt(r.amount);
                break;
            case "2":
                ret.love = _.parseInt(r.amount);
                break;
            case "3":
                ret.wow = _.parseInt(r.amount);
                break;
            case "4":
                ret.haha = _.parseInt(r.amount);
                break;
            case "7":
                ret.sad = _.parseInt(r.amount);
                break;
            case "8":
                ret.angry = _.parseInt(r.amount);
                break;
            case "11":
                ret.thankful = _.parseInt(r.amount);
                break;
            default:
                debug("Uncommon reaction spot: %s", JSON.stringify(r));
        };
    });
    return ret;
};

function lookintoHTMLs(timeline, counter) {

    return Promise.all([
        mongo.read(nconf.get('schema').htmls, {
            timelineId: timeline.id,
            publicationUTime: { "$exists": true }
        }, { savingTime: -1 }),
        mongo.read(nconf.get('schema').impressions, {
            timelineId: timeline.id
        }),
        timeline.name
    ])
    .then(function(combos) {

        debug("htmls %d, impressions %d, %s timeline %s of %s",
            _.size(combos[0]), _.size(combos[1]), combos[2],
            timeline.id, timeline.name);

        if(_.size(combos[0]) < 3)
            return [];

        return _.map(combos[0], function(html, i) {

            var impression = _.find(combos[1], { htmlId: html.id });
            var ret = new Object();

            if(html.permaLink) {
                if(html.hrefType === "groupPost")
                    ret.pageName = html.permaLink.split('/')[2];
                else
                    ret.pageName = html.permaLink.split('/')[1];
            }

            ret.profile = combos[2];

            if(!html.postId) {
                debug("Warning, no postId in %s", html.id);
                return null;
            }

            ret.postId = String(html.postId);

            if(html.externalHref) {
                ret.externals = _.map(html.externalHref, function(link) {
                    return {
                        link: link,
                        id: various.hash({
                            'href': link,
                            'type': "original"
                        })
                    };
                });
            }

            /* the timings are recorded in GTM, I originally they were converted in
             * display in Buenos Aires time:
            moment(impression.impressionTime).utcOffset(-180).format();
            moment(html.publicationUTime * 1000).utcOffset(-180).format();
             *
             * but with the comparison of FB API posts it is simpler keep them GMT */
            ret.impressionTime = moment(impression.impressionTime)
                .utcOffset(0)
                .format();
            ret.publicationTime = moment(html.publicationUTime * 1000)
                .utcOffset(0)
                .format();
            ret.visualizationDiff = moment
                .duration(
                    moment(impression.impressionTime) - moment(html.publicationUTime * 1000)
                )
                .asSeconds();

            ret.type = html.hrefType;
            ret.displayName = html.source;

            /* if displayName is null, it is probably an album,
             * and only two people posted an album */
            if(ret.pageName === '' && ret.type === 'album') {
                var userId = _.split(html.permaLink, '&')[0].split('.')[5];

                if(userId === "1439011312989701") {
                    ret.displayName = "Jorge Taiana";
                    ret.pageName = "TaianaJorge";
                }
                else if(userId === "115689108495633") {
                    ret.displayName = "Cristina Fernandez de Kirchner";
                    ret.pageName = "CFKArgentina";
                }
                else
                    debug("Warning, `album` not seen in testing database - id: %s", html.id);
            }

            return _.merge(ret,
                flattenReactions(html.rmap),
                // patternMap(html.html),
                _.pick(impression, ['impressionOrder' ]),
                _.pick(html, ['id', 'text', 'permaLink', 'rtotal', 'comments', 'shares', 'timelineId' ])
            );
        });
    });
}

function postSequence(content) {

    var bid = _.groupBy(content, 'postId');
    var unsorted = _.map(bid, function(posts, postId) {

        var ret = {
            postId: postId,
            publicationTime: posts[0].publicationTime,
            mpt: moment(posts[0].publicationTime),
            pageName: posts[0].pageName,
        };

        if(posts[0].externals)
            ret.externals = posts[0].externals;

        if(posts[0].text)
            ret.text = posts[0].text;

        var appears = _.map(posts, function(p) {
            return _.pick(p, ['visualizationDiff', 'impressionOrder', 'profile', 'id']);
        });

        ret.appears = _.sortBy(appears, 'visualizationDiff');
        return ret;
    });

    return _.map(_.sortBy(unsorted, 'mpt'), function(p) {
        return _.omit(p, ['mpt']);
    });
};

function beginQuery(user) {

    var filter = _.extend(timelinefi, {
        startTime: {
            "$gt": new Date(timeFilter.start),
            "$lt": new Date(timeFilter.end) 
        },
        nonfeed: { "$exists": false },
        userId: _.parseInt(user.id)
    });
   
    return mongo
        .read(nconf.get('schema').timelines, filter, { startTime: -1 })
        .map(function(e, i) {
            e.name = user.name;
            return e;
        })
        .tap(function(r) {
            debug("¹ user %j contributed with %d timelines", user, _.size(r));
        })
        .map(lookintoHTMLs, { concurrency: 1 })
        .then(_.flatten)
        .tap(function(r) {
            debug("² user %j contributed with %d posts", user, _.size(r));
        });
};

