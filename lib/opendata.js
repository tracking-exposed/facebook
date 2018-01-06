var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:opendata');
var nconf = require('nconf');
 
var mongo = require('./mongo');
var utils = require('./utils');

var queryContent = function(req) {
    /* At the moment, only one content by ID can be requested */
    var Q = req.body;
    var avail = ['timelines', 'impressions', 'htmls'];
    var queid = /^[a-fA-F0-9]+$/.exec(Q.id);
    
    if(avail.indexOf(Q.column) === -1 || !queid)
        throw new Error("Invalid request");

    queid = _.first(queid);
    debug("%s Requested element id %s from %s",
        req.randomUnicode, queid, Q.column);

    return mongo
        .read(nconf.get('schema')[Q.column], { id: queid })
        .then(function(elementL) {
            var c =  _.first(elementL);
            if(Q.column === 'htmls')
                c = _.omit(c, ['html']);

            return {
                'json': {
                    'type': Q.column,
                    'element': c
                }
            };
        });
};

function getNodeNumbers() {
    var columns = [ "supporters", "timelines", "impressions", "htmls", "accesses" ];
    debug("getNodeStats %j", columns);
    return Promise.map(columns, function(cn) {
        return mongo.countByMatch(nconf.get('schema')[cn], {});
    })
    .then(function(numbers) {
        debug("node #%j", _.zipObject( columns, numbers));
        return _.zipObject( columns, numbers);
    });
};

function openDataHref(req) {

    var campaign = req.params.campaign;
    var MAX = _.parseInt(req.params.max) || 500;

    var filter = { feedHref: true };

    if(campaign && typeof nconf.get(campaign) === 'object') {
        var ids = _.map(nconf.get(campaign), function(user) {
            return _.parseInt(user.id);
        });
        filter.userId = { "$in": ids };
        debug("openDataHref campaign %s accepted", campaign);
    } else 
        debug("openDataHref, generic query received max %d results", MAX);

    return mongo
        .readLimit(nconf.get('schema').htmls, filter, { savingTime: -1 }, MAX, 0)
        .reduce(function(memo, e) {
            _.each(e.externalHref, function(l) {
                var exists = _.find(memo, { link: l });
                if(exists)
                    exists.count += 1;
                else
                    memo.push({
                        count: 1,
                        link: l,
                        putime: moment(e.publicationUTime * 1000).toISOString()
                    });
            });
            return memo;
        }, [])
        .then(function(r) {
            debug("openDataHref returning %d links", _.size(r));
            return { json: _.orderBy(r, { putime: -1}) };
        });

};


/* Metadata extraction for elezioni.tracking.exposed and other sub-projects */
var types = [ 'sponsored', 'href', 'post' ];
function composeSelector(type, timeline) {
    switch(type) {
        case 'sponsored':
            return { timelineId: timeline.id, type: 'promoted' };
        case 'href':
            return { timelineId: timeline.id, feedHref: true };
        case 'post':
            return { timelineId: timeline.id, type: 'feed' };
    };
};

var functions = {
    'sponsored': aggregateSponsored,
    'href': aggregateHref,
    'post': aggregatePosts
};

function aggregateSponsored(memo, e) {
    var o = _.pick(e, ['savingTime', 'ownerName', 'postLink', 'promotedPage', 'title', 'titleId' ]);
    memo.push(o);
    return memo;
};

function aggregatePosts(memo, e) {
    var o = _.pick(e, ['savingTime', 'postId', 'source', 'permaLink', 'publicationUTime' ]);
    memo.push(o);
    return memo;
};
function aggregateHref(memo, e) {
    var o = _.pick(e, ['externalHref', 'publicationUTime', 'permaLink', 'source' ]);
    _.each(o.externalHref, function(l) {
        memo.push({
            permaLink: e.permaLink,
            source: e.source,
            link: l,
            putime: moment(o.publicationUTime * 1000).toISOString()
        });
    });
    return memo;
};


function metaxpt(req) {
    /* this function take in input a country code and a number of hours
     * to go back in the past and take the 1 hours before. by default,
     * /api/v1/metaxpt/IT/sponsored/0 means: 
     * look at the last 24 hours timelines, get only the sponsored post, 
     *
     * sponsored: { id, href, type, source, numbersOf, ids },
     * href: same as href above in this file
     * sources: { pageName, occurencies }
     *
     * and /api/v1/sponsored/IT/4 goes 4 hours back from moment() and took
     * the window between 6 hours ago and 4.
     *
     * */

    /* expected format:
     * /api/v1/meta/[IT|silver]/[sponsored|href]/(\d+)
     */
    var type = req.params.type;
    var e = _.parseInt(req.params.hoursago);
    var selector = {};

    if(_.isNaN(e))
        throw new Error("Invalid request (the number)");

    if(_.size(req.params.selector) != 2 )
        _.set(selector, 'tagId', req.params.selector);
    else
        _.set(selector, 'geoip', req.params.selector);

    if(types.indexOf(type) === -1)
        throw new Error("Invalid type requested");

    var end = moment().subtract(e, 'h').startOf('hour').toISOString();
    var start = moment().subtract(e + 1, 'h').startOf('hour').toISOString();

    var retV = {
        queryInfo: {
            times: [ start, end ],
            now: moment().format(),
            hoursback: e,
            timeId: utils.hash({'start': start, 'end': end}),
            selector: JSON.parse(JSON.stringify(selector))
        },
        results: []
    };

    var timelineq = _.extend(selector, { startTime: {
        $gt: new Date(start),
        $lt: new Date(end)
    }});

    return mongo
        .read(nconf.get('schema').timelines, timelineq)
        .tap(function(i) {
            debug("metadata export %j ∴ %d timelines",
                retV.queryInfo, _.size(i) );
        })
        .map(function(tmln) {
            var htmlselector = composeSelector(type, tmln);
            return mongo
                .read(nconf.get('schema').htmls, htmlselector);
        }, { concurrency: 4})
        .then(_.flatten)
        .reduce(_.get(functions, type), retV.results)
        .then(function(pl) {
            debug("metadata extractionm completed, %d elements", _.size(retV.results));
            return { json: retV };
        });
};

module.exports = {
    queryContent: queryContent,
    getNodeNumbers: getNodeNumbers,
    openDataHref: openDataHref,
    metaxpt: metaxpt
};
