var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:events');
var os = require('os');
var nconf = require('nconf');

var signer = require('nacl-signature');
var bs58 = require('bs58');
 
var mongo = require('./mongo');
var utils = require('./utils');


function debugTimeDiff(source, receivedTime) {
    /* just to understand */
    var Tlocal = moment();
    var Tremote = moment(receivedTime);
    debug("   Time difference %s ↓%s and %s = %s", source,
        Tlocal.format("HH:mm:SS"), Tremote.format("HH:mm:SS"),
        moment.duration(Tremote - Tlocal).humanize() );
}

function hasError(retDict) {
    return (!_.isUndefined(_.get(retDict, 'error')));
};

function reportError(where, err) {
    debug("%s Error detected and raised %s: %s",
        req.randomUnicode, where, err);
    throw new Error(where + '-' + err);
};

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
    if(_.size(errs)) {
        debug("Error in processHeaders: %j", errs);
        return { 'errors': errs };
    }
    return ret;
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
        debugTimeDiff("T", evnt.startTime);

        if(evnt.location !== 'https://www.facebook.com/')
            newTmln.nonfeed = true;

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

        /* debugTimeDiff("I", evnt.impressionTime); */

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

    debug("Unexpected type: %s, abort", evnt.type);
    memo.error.push(JSON.stringify({
        'kind': "invalid type",
        'event': evnt
    }));
    return memo;
};

function promisifyInputs(body, geoinfo, supporter) {

    var processed = _.reduce(body, parseEvents, {
        'timelines': [],
        'impressions': [],
        'htmls': [],
        'errors': [],
        'sessionInfo': { 
            'geoip': geoinfo,
            'numId': supporter.userId,
            'publicKey': supporter.publicKey,
            'version': supporter.version
        }
    });

    if(hasError(processed))
        reportError('body parsing', processed.error);

    var functionList = [];
    
    if(_.size(processed.htmls))
        functionList.push(
            mongo
                .writeMany(nconf.get('schema').htmls, processed.htmls)
                .return({ 'kind': 'htmls', 'amount': _.size(processed.htmls) })

        );

    if(_.size(processed.impressions))
        functionList.push(
            mongo
                .writeMany(nconf.get('schema').impressions, processed.impressions)
                .return({ 'kind': 'impressions', 'amount': _.size(processed.impressions) })
        );

    if(_.size(processed.timelines))
        functionList.push(
            mongo
                .writeMany(nconf.get('schema').timelines, processed.timelines)
                .return({ 'kind': 'timelines', 'amount': _.size(processed.timelines) })
        );

    functionList.push(
        mongo
            .updateOne(nconf.get('schema').supporters, {
                    publicKey: supporter.publicKey,
                    userId: _.parseInt(supporter.userId)
                },
                _.set(supporter, 'lastActivity', new Date(moment().toISOString()))
             )
    );

    debug("⭐ %d impressions %d html %d timelines; user %d [%s] last activity %s ⭐ %s",
        _.size(processed.impressions), _.size(processed.htmls),
        _.size(processed.timelines), supporter.userId, geoinfo, 
        moment.duration(moment() - moment(supporter.lastActivity)).humanize(),
        supporter.version);

    return functionList;
};

function processEvents(req) {

    var ipaddr = _.get(req.headers, "x-forwarded-for") || "127.0.0.1";
    var geoip = utils.getGeoIP(ipaddr);
    var geoinfo = geoip.code;

    if(!geoinfo) {
        geoinfo = geoip.ip;
        if(geoinfo !== "127.0.0.1") {
            debug("Anomaly, unresolved IP different from localhost: %s", geoinfo);
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
    if(hasError(headers))
        reportError('header parsing, missing', headers.error);

    return mongo
        .read(nconf.get('schema').supporters, {
            userId: _.parseInt(headers.supporterId),
            publicKey: headers.publickey
        })
        .then(function(supporterL) {
            if(_.size(supporterL) > 1) {
                debug("Error, only manual management can fix this! %s",
                    JSON.stringify(supporterL, undefined, 2));
            }
            return _.first(supporterL);
        })
        .then(function(supporter) {
            if(!_.every([ headers.signature, supporter.publicKey], _.size)) {
                /* TODO find out why req.rawBody do not exists */
                debug("Validation fail: signed %s retrieved pubkey %s",
                    headers.signature, supporter.publicKey);
                throw new Error("Signature can't be verify");
            }
            /* else, still I've to verify the actual signature */
            supporter.version = headers.version;
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
            } };
        })
        .catch(function(error) {
            return { 'json': {
                'status': 'error',
                'info': error.message
            }};
        });
};

module.exports = {
  processEvents: processEvents
};
