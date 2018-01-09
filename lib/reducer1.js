var _ = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('lib:reducer:1');
var moment = require('moment');
var nconf = require('nconf');
var fs = Promise.promisifyAll(require('fs'));

var utils = require('./utils');
var mongo = require('./mongo');
var various = require('./various');

/* this reducer:
 * merge impression and posts
 * hide userId
 * export them for data reuse.    */

function dateim(hours, defaulth) {
    var hoursm = _.parseInt(hours);
    if(_.isNaN(hoursm))
        hoursm = defaulth;
    return moment()
        .startOf('hour')
        .subtract(hoursm, 'h')
        .toISOString();
};


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
                debug("Warning: album, something to be debug here");
            }

            return _.merge(ret,
                flattenReactions(html.rmap),
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

function timelineSearch(timewindow, user) {

    var filter = {
        startTime: {
            "$gt": new Date(timewindow.start),
            "$lt": new Date(timewindow.end) 
        },
        nonfeed: { "$exists": false },
        userId: _.parseInt(user.id)
    };
   
    return mongo
        .read(nconf.get('schema').timelines, filter, { startTime: -1 })
        .map(function(e, i) {
            e.name = user.name;
            return e;
        })
        .tap(function(r) {
            debug("¹ user %j contributed with %d timelines in %s between %s and %s",
                user, _.size(r), 
                moment.duration(moment(timewindow.start) - moment(timewindow.end) ).humanize(),
                timewindow.start, timewindow.end
            );
        })
        .map(lookintoHTMLs, { concurrency: 1 })
        .then(_.flatten)
        .tap(function(r) {
            debug("² user %j contributed with %d posts", user, _.size(r));
        });
};

function reducer1(req) {
    /* this function could be a bit CPU-intensive, that's
     * why is password protected */
    var authkey = req.params.authkey;

    /* temportarly hardcoded, despite can be open to tagId, 
     * in this way I can put presudonym to users instead of userId */
    var italy2018File = "config/italy-2018.json";
    var retVal = { impressions: [], posts: [] };
    var lookForTimelines = _.partial(timelineSearch, {
        start: dateim(req.params.start, 2),
        end: dateim(req.params.end, 0)
    });

    return various
        .loadJSONfile(italy2018File)
        .then(function(x) {
            if(x.key !== req.params.authkey)
                throw new Error("Invalid key");
            debug("Key accepted!");
            return x.users;
        })
        .map(lookForTimelines, { concurrency: 1})
        .then(_.flatten)
        .tap(function(c) {
            debug("[+] Impressions returned %d", _.size(c));
            /* saving the file, all the data are kept togheder, but not 'text' */
            var clean = _.map(c, function(o) { return _.omit(o, ['text', 'externals'])});
            retVal.impressions = clean;
        })
        .then(postSequence)
        .tap(function(p) {
            debug("[+] Unique posts %d", _.size(p));
            /* saving the post, all the data are kept togheder */
            retVal.posts = p;
        })
        .then(function() {

            return { json: retVal };
        })
        .catch(function(e) {
            return { json: { error: e.text }};
        });
}

module.exports = reducer1;
