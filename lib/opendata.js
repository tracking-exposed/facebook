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


/*
 * Metadata extraction for elezioni.tracking.exposed and other sub-projects 
 */
var types = [ 'sponsored', 'href' ]; // 'metadata' ];
function composeSelector(type, timeline) {
    switch(type) {
        case 'sponsored':
            return { timelineId: timeline.id, type: 'promoted' };
        case 'href':
            return { timelineId: timeline.id, feedHref: true };
    };
};
function selectf(type) {
    switch(type) {
        case 'sponsored':
            return aggregateSponsored;
        case 'href':
            return aggregateHref;
    };
};

function aggregateSponsored(memo, e) {
    var o = _.pick(e, ['savingTime', 'ownerName', 'promotedMedia', 
                       'promotedPage', 'title', 'titleId' ]);

    var check = _.find(memo, o.titleId);
    if(check) 
        check.occ += 1;
    else {
        o.occ = 1;
        memo.push(o);
    }
    return memo;
};

function aggregateHref(memo, e) {
    var o = _.pick(e, ['externalHref', 'publicationUTime' ]);

    _.each(o.externalHref, function(l) {
        var exists = _.find(memo, { link: l });
        if(exists)
            exists.count += 1;
        else {
            memo.push({
                count: 1,
                link: l,
                putime: moment(o.publicationUTime * 1000).toISOString()
            });
        }
    });
    return memo;
};

function linkXptByCC(req) {
    var e = _.parseInt(req.params.hoursago);
    var selector = req.params.selector;
    var type = req.params.type;

    if(_.isNaN(e) || _.size(cc) != 2 || types.indexOf(type) === -1)
        throw new Error("Invalid request");

    return metaXpt({geoip: cc}, e, type);
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

    // XXX
    selector.geoip = "127.0.0.1";

    if(types.indexOf(type) === -1)
        throw new Error("Invalid type requested");

    var x = _.round(
        moment.duration(moment() - moment().startOf('year')).asSeconds() / (5 * 60)
    );

    var end = moment().subtract(e, 'h').startOf('hour').toISOString();
    var start = moment().subtract(e + 1, 'h').startOf('hour').toISOString();

    var retV = {
        queryInfo: {
            times: [ start, end ],
            now: moment().format(),
            hoursback: e,
            timeId: utils.hash({'start': start, 'end': end})
        },
        results: []
    };

    var timelineq = _.extend(selector, { startTime: {
        $gt: new Date(start),
        $lt: new Date(end)
    }});

    var aggregatefunction = selectf(type);

    return mongo
        .read(nconf.get('schema').timelines, timelineq)
        .tap(function(i) {
            debug("metadata export, %j", retV.queryInfo);
        })
        .map(function(tmln) {
            var htmlselector = composeSelector(type, tmln);
            return mongo
                .read(nconf.get('schema').htmls, htmlselector);
        }, { concurrency: 4})
        .then(_.flatten)
        .reduce(aggregatefunction, retV.results)
        .then(function(pl) {
            debug("metadata selection done, %s elements", _.size(retV.results));
            return { json: retV };
        });
};

module.exports = {
    queryContent: queryContent,
    getNodeNumbers: getNodeNumbers,
    openDataHref: openDataHref,
    metaxpt: metaxpt
};
