var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('routes:events');
var os = require('os');
var nconf = require('nconf');

var signer = require('nacl-signature');
var bs58 = require('bs58');

var mongo = require('../lib/mongo');
var utils = require('../lib/utils');
var echoes = require('../lib/echoes');
var adopters = require('../lib/adopters');

function processHeaders(received, required) {
    var ret = {};
    var errs = _.map(required, function(destkey, headerName) {
        var r = _.get(received, headerName);
        if(_.isUndefined(r))
            return headerName;

        _.set(ret, destkey, r);
        return null;
    });
    errs = _.compact(errs);
    return _.size(errs) ? { errors: errs } : ret;
};

function parseEvents(memo, evnt) {

    if(evnt.type === 'timeline') {
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

    if(evnt.type === 'impression') {
        var impression = _.pick(evnt, ['visibility', 'html' ] );

        impression.timelineId = utils.hash({
            'uuid': evnt.timelineId,
            'user': memo.sessionInfo.numId
        });
        impression.id = utils.hash({
            'uuid': evnt.timelineId,
            'user': memo.sessionInfo.numId,
            'order': evnt.impressionOrder
        });
        impression.userId = memo.sessionInfo.numId;

        impression.impressionOrder = _.parseInt(evnt.impressionOrder);
        impression.impressionTime = new Date(
            moment(evnt.impressionTime).toISOString()
        );

        if(_.eq(impression.visibility, 'public')) {

            if(!_.size(impression.html))
                debug("Strange: public impression with zero size HTML?");

            impression.htmlId = utils.hash({ 'html': impression.html });

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
            debug("Warning! private post leakage? %d",
                _.size(impression.html));
            /* this is impossible, but if happen I want to see it */
        }

        memo.impressions.push(_.omit(impression, ['html']));
        return memo;
    }

    if (evnt.type === 'anomaly') {
        var anomaly = {
            impressionCounter: evnt.impressionCounter,
            userId: memo.sessionInfo.numId,
            geoip: memo.sessionInfo.geoip,
            version: memo.sessionInfo.version,
            previous: evnt.previous,
            current: evnt.current,
            when: new Date(), // a mongodb TTL is set on `when`, 
                              // making this info object after a while
        };
        anomaly.timelineId = utils.hash({
            'uuid': evnt.timelineId,
            'user': memo.sessionInfo.numId
        });

        /* if an anomaly is found, is logged directly in the ELK */
        echoes.echo({
            id: Math.round((new Date()).getTime() / 1000),
            index: "anomaly",
            timelineId: supporter.userId,
            recordedAt: new Date(),
            version: memo.sessionInfo.version,
        });

        debug("anomaly from [%s], timelineId %s",
            memo.sessionInfo.geoip, anomaly.timelineId);
        memo.anomalies.push(anomaly);
        return memo;
    }

    debug("Error! unexpected event type: [%s]", evnt.type);
    memo.errors.push(JSON.stringify({
        'kind': "unexpected type",
        'event': evnt
    }));
    return memo;
};

function promisifyInputs(body, geoinfo, supporter) {

    var processed = _.reduce(body, parseEvents, {
        'timelines': [],
        'impressions': [],
        'htmls': [],
        'anomalies': [],
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

    if(_.size(processed.anomalies))
        functionList.push(mongo
            .writeMany(nconf.get('schema').anomalies, processed.anomalies)
            .return({
                'kind': 'anomalies',
                'amount': _.size(processed.anomalies)
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
    if(processed.timelines && processed.timelines[0] && processed.timelines[0].nonfeed)
        debug(" * non-newsfeed navigation: no content received");
    else {
        processed_timelines = _.size(processed.timelines)
        processed_impressions =  _.size(processed.impressions)
        processed_html = _.size(processed.htmls)
        
        debug(" * %d timelines %d impressions %d html %s",
            processed_timelines, processed_impressions, processed_html,
            _.get(processed.timelines[0], 'tagId') ?
                "tagId " + processed.timelines[0].tagId :
                ""
            );
    }

    var ts = Math.round((new Date()).getTime() / 1000);

    echoes.echo({
        id: ts,
        index: "fbtrex_users",
        pseudo: supporter.userId,
        geo: geoinfo,
        last_activity: supporter.lastActivity,
        timelines: processed_timelines,
        impressions: processed_impressions,
        htmls: processed_html
    });

    if(_.size(processed.impressions))
        debug(" * impressionOrder 1st %d last %d",
            _.first(processed.impressions).impressionOrder,
            _.last(processed.impressions).impressionOrder
        );

    return functionList;
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

    var headers = processHeaders(_.get(req, 'headers'), {
        'content-length': 'length',
        'x-fbtrex-build': 'build',
        'x-fbtrex-version': 'version',
        'x-fbtrex-userid': 'supporterId',
        'x-fbtrex-publickey': 'publickey',
        'x-fbtrex-signature': 'signature'
    });

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

    return mongo
        .read(nconf.get('schema').supporters, {
            userId: _.parseInt(headers.supporterId),
            publicKey: headers.publickey
        })
        .then(function(supporterL) {

            if(!_.size(supporterL))
                return adopters.create(headers);

            if(_.size(supporterL) > 1) {
                // TODO: we can delegate the uniqueness check to MongoDB. 
                // We can achieve this by creating a compound key
                // db.supporters.createIndex( { "userId": 1, "publicKey": 1 } )
                debug("Error: %j -- duplicated supporter", supporterL);
            }

            var supporter = _.first(supporterL);

            if(supporter.version !== headers.version)
                debug(" * Supporter %s version upgrade %s to %s",
                    supporter.pseudo, supporter.version, headers.version);

            debug(" * Supporter %s [%s] last activity %s (%s ago) %s",
                supporter.pseudo, geoinfo,
                moment(supporter.lastActivity).format("HH:mm DD/MM"),
                moment.duration(moment.utc()-moment(supporter.lastActivity)).humanize(),
                supporter.version);

            supporter.version = headers.version;
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
            debug("Event submission ignored: %s", error.message);
            return { 'json': {
                'status': 'error',
                'info': error.message
            }};
        });
};

module.exports = {
    processEvents: processEvents
};
