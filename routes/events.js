var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('routes:events');
var nconf = require('nconf');

var mongo = require('../lib/mongo');
var utils = require('../lib/utils');
var adopters = require('../lib/adopters');
var security = require('../lib/security');

function buildTimeline(memo, evnt) {
    newTmln = {};
    newTmln.startTime = new Date(moment(evnt.startTime).toISOString());
    newTmln.userId = memo.sessionInfo.numId;
    newTmln.geoip = memo.sessionInfo.geoip;
    newTmln.id = utils.hash({
        'uuid': evnt.id,
        'user': memo.sessionInfo.numId
    });

    if(evnt.location !== 'https://www.facebook.com/')
        newTmln.nonfeed = true;

    if(_.get(evnt, 'tagId'))
        newTmln.tagId = evnt.tagId;

    memo.timelines.push(newTmln);
    return memo;
}

function buildImpression(memo, evnt) {
    var impression = _.pick(evnt, ['visibility', 'html', 'from', 'kind']);

    impression.timelineId = utils.hash({
        'uuid': evnt.timelineId,
        'user': memo.sessionInfo.numId,
    });
    impression.id = utils.hash({
        'uuid': evnt.timelineId,
        'user': memo.sessionInfo.numId,
        'order': evnt.impressionOrder,
    });
    impression.userId = memo.sessionInfo.numId;

    impression.impressionOrder = _.parseInt(evnt.impressionOrder);
    impression.impressionTime = new Date(
        moment(evnt.impressionTime).toISOString()
    );

    if(_.eq(impression.visibility, 'public')) {

        if(!_.size(impression.html))
            debug("Strange: public impression with zero size HTML?");

        impression.htmlId = utils.hash({
            'html': impression.html,
            'user': memo.sessionInfo.numId,
        });

        var snippet = {
            savingTime: new Date(moment().toISOString()),
            id: impression.htmlId,
            userId: memo.sessionInfo.numId,
            impressionId: impression.id,
            timelineId: impression.timelineId,
            html: impression.html
        };
        memo.htmls.push(snippet);
    } else if( _.size(impression.html) ) {
        debug("Warning! private post leakage? %d", _.size(impression.html));
        /* this is impossible, but if happen I want to see it */
    }

    memo.impressions.push(_.omit(impression, ['html']));
    return memo;
}

function buildEvent(memo, evnt) {
    const evelif = {
        id: evnt.id,
        path: evnt.path,
        html: evnt.element,
        publicKey: evnt.sessionInfo.publicKey,
        openingTime: new Date(evnt.openingTime),
        savingTime: new Date(moment().toISOString()),
    };
    memo.evelif.push(evelif);
    return memo;
}

function parseEvents(memo, evnt) {

    if(evnt.type === 'timeline')
        return buildTimeline(memo, evnt);

    if(evnt.type === 'impression')
        return buildImpression(memo, evnt);
    
    if (evnt.type === 'evelif')
        return buildEvent(memo, evnt);

    debug("Error! unexpected event type: [%s]", evnt.type);
    memo.errors.push({ kind: "unexpected type", type: evnt.type });
    return memo;
};

function promisifyInputs(body, geoinfo, supporter) {

    var processed = _.reduce(body, parseEvents, {
        'timelines': [],
        'impressions': [],
        'htmls': [],
        'evelif': [],
        'errors': [],
        'sessionInfo': {
            'geoip': geoinfo,
            'numId': supporter.userId,
            'publicKey': supporter.publicKey,
            'version': supporter.version
        }
    });

    if(_.size(processed.errors))
        return debug("Error in processing event: %j", processed.errors);

    var functionList = [];

    if(_.size(processed.htmls))
        functionList.push(mongo
            .writeMany(nconf.get('schema').htmls, processed.htmls)
            .return({
                'kind': 'htmls',
                'amount': _.size(processed.htmls)
            })
        );

    if(_.size(processed.impressions))
        functionList.push(mongo
            .writeMany(nconf.get('schema').impressions,processed.impressions)
            .return({
                'kind': 'impressions',
                'amount': _.size(processed.impressions)
            })
        );

    if(_.size(processed.timelines))
        functionList.push(mongo
            .writeMany(nconf.get('schema').timelines, processed.timelines)
            .return({
                'kind': 'timelines',
                'amount': _.size(processed.timelines)
            })
        );

    if(_.size(processed.evelif))
        functionList.push(mongo
            .writeMany(nconf.get('schema').evelif, processed.evelif)
            .return({
                'kind': 'evelif',
                'amount': _.size(processed.evelif)
            })
        );

    functionList.push(mongo
        .updateOne(nconf.get('schema').supporters, {
                publicKey: supporter.publicKey,
                userId: _.parseInt(supporter.userId)
            }, supporter)
    );

    var processed_timelines = 0
    var processed_impressions = 0
    var processed_html = 0
    
    /* this big debug noise is handy on the server */
    if(processed.timelines[0] && processed.timelines[0].nonfeed) {
        debug(" * non-newsfeed navigation: no content received");
    }
    else {
        processed_timelines = _.size(processed.timelines)
        processed_impressions =  _.size(processed.impressions)
        processed_html = _.size(processed.htmls)
        debug(" * %s: %d timelines %d impressions %d htmls",
            supporter.pseudo, processed_timelines, processed_impressions, processed_html);
    }

    if(_.size(processed.impressions))
        debug(" * impressionOrder %d to %d [mirror queue %d elems]",
            _.first(processed.impressions).impressionOrder,
            _.last(processed.impressions).impressionOrder,
            _.size(last)
        );

    return functionList;
};

var last = null;
function getMirror(req) {

    if(!security.checkPassword(req)) {
        debug("getMirror: authentication failure!");
        return security.authError;
    }

    if(last) {
        let retval = Object(last);
        last = null;
        debug("getMirror: authentication successfull, %d elements in volatile memory",
            _.size(retval) );
        return { json: { content: retval, elements: _.size(retval) }};
    } else
        debug("getMirror: auth OK, but nothing to be returned");

    return { json: { content: null } };
}
function appendLast(req) {
    const MAX_STORED_CONTENT = 10;
    if(!last) last = [];
    if(_.size(last) > MAX_STORED_CONTENT) 
        last = _.tail(last);

    last.push(_.pick(req, ['headers', 'body']));
};

function processEvents(req) {

    var ipaddr = _.get(req.headers, "x-forwarded-for") || "127.0.0.1";
    var geoip = utils.getGeoIP(ipaddr);
    var geoinfo = geoip.code;

    if(!geoinfo) {
        geoinfo = geoip.ip;
        if(geoinfo !== "127.0.0.1") {
            // debug("Anomaly, unresolved IP different from localhost: %s", geoinfo);
            geoinfo = "redacted";
        }
    }

    const headers = adopters.processHeaders(_.get(req, 'headers'));
    if(_.size(headers.errors))
        return debug("headers parsing error missing: %j", headers.errors);

    /* first thing: verify signature integrity */
    if (!utils.verifyRequestSignature(req)) {
        debug("event ignored: invalid signature, body of %d bytes, headers: %j",
            _.size(req.body), req.headers);
        return { 'json': {
            'status': 'error',
            'info': "Invalid signature"
        }};
    }

    appendLast(req);

    return mongo
        .read(nconf.get('schema').supporters, {
            userId: _.parseInt(headers.supporterId),
            publicKey: headers.publickey
        })
        .then(function(supporterL) {

            if(!_.size(supporterL)) {
                debug("Warning: creation of a new supporter, this shouldn't happen here but in routes/selector!");
                let newsupp = adopters.create(headers);
                supporterL.push(newsupp);
            }

            if(_.size(supporterL) > 1) {
                // TODO: we can delegate the uniqueness check to MongoDB. 
                // We can achieve this by creating a compound key
                // db.supporters.createIndex( { "userId": 1, "publicKey": 1 } )
                debug("(error|warning): %d duplicated supporter", supporterL[0].userId);
            }

            const supporter = _.first(supporterL);

            if(supporter.version !== headers.version) {
                debug(" * Supporter %s version upgrade %s to %s",
                    supporter.pseudo, supporter.version, headers.version);
                supporter.version = headers.version;
            }

            debug(" * Supporter %s [%s] last activity %s (%s ago) %s",
                supporter.pseudo, geoinfo,
                moment(supporter.lastActivity).format("HH:mm DD/MM"),
                moment.duration(moment.utc()-moment(supporter.lastActivity)).humanize(),
                supporter.version);

            _.set(supporter, 'lastActivity', new Date());
            return supporter;
        })
        .then(function(supporter) {
            return promisifyInputs(req.body, geoinfo, supporter);
        })
        .all()
        .then(function(results) {
            return { "json": {
                "status": "OK",
                "info": results
            }};
        })
        .catch(function(error) {
            console.error(error);
            debug("Event submission ignored: %s", error.message);
            return { 'json': {
                'status': 'error',
                'info': error.message
            }};
        });
};

module.exports = {
    processEvents,
    getMirror
};
