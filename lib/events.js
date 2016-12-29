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

function promisifyInputs(body, version, geoinfo, supporter) {

    var processed = _.reduce(body, parseEvents, {
        'timelines': [],
        'impressions': [],
        'htmls': [],
        'errors': [],
        'sessionInfo': { 
            'numId': supporter.userId,
            'geoip': geoinfo,
            'version': version
        }
    });

    if(hasError(processed))
        reportError('body parsing', processed.error);

    var functionList = [];
    
    if(_.size(processed.htmls))
        functionList.push(
            mongo.writeMany(nconf.get('schema').htmls,
                            processed.htmls)
        );

    if(_.size(processed.impressions))
        functionList.push(
            mongo.writeMany(nconf.get('schema').impressions,
                            processed.impressions)
        );

    if(_.size(processed.timelines))
        functionList.push(
            mongo.writeMany(nconf.get('schema').timelines,
                            processed.timelines)
        );

    functionList.push(
        mongo.updateOne(
            nconf.get('schema').supporters,
            { userId: supporter.userId },
            _.set(supporter, "lastActivity", new Date(moment().toISOString()) )
        )
    );

    debug("Saving %d impressions %d html %d timelines; user %d from %s ver %s",
        _.size(processed.impressions), _.size(processed.htmls),
        _.size(processed.timelines), supporter.userId, geoinfo, version);

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

    /* special: to use operations/stressTest.js with valid
     * headers/body, will break the collection, but will save the payload.
     * then read operations/README.md
     *
    return utils
        .shmFileWrite('stressTest', JSON.stringify({
                                        headers: req.headers,
                                        body: req.body
        }));
     *
     */

    return mongo
        .read(nconf.get('schema').supporters, {
            userId: _.parseInt(headers.supporterId)
        })
        .then(function(supporterL) {
            return _.first(supporterL);
        })
        .then(function(supporter) {
            if(!supporter || !_.isInteger(supporter.userId)) {
                debug("UserId %d not found: *recording anyway*", headers.supporterId);
                // throw new Error('user lookup - userId not found');
                return {
                    'userId': headers.supporterId,
                    'protocolViolation': true
                }
            } else {
                debug("UserId %d found", headers.supporterId);
                return supporter;
            }

            // console.log(_.size(req.rawBody));
            // debug("%d", _.size(supporter.publicKey));
            // if (signer.verify('NaCL is amazing!', signature, publicKey))
            // raise error if fail -- work in progress
        })
        .then(function(supporter) {
            return promisifyInputs(req.body, headers.version, geoinfo, supporter);
        })
        .all()
        .then(function(results) {
            /* Still think if something deserve to be communicated back:
             * special post status to highlight ?
             * new updates/link/blogpost ?
             * secret to be refreshes ?
             */
            return { "json": { "status": "OK" }};
        })
        .catch(function(error) {
            debug(error.stack);
            console.trace();
            return { 'json': {
                'status': 'error',
                'details': error.message
            }};
        });
};

module.exports = {
  processEvents: processEvents
};
