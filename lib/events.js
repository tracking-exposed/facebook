var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('events');
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
    debug("⏳ Time difference %s ↓%s and %s = %s", source,
        Tlocal.format("HH:mm:SS"), Tremote.format("HH:mm:SS"),
        moment.duration(Tremote - Tlocal).humanize() );
}

function hasError(retDict) {
    return (!_.isUndefined(_.get(retDict, 'error')));
};

function reportError(where, err, req) {
    debug("%s Error detected and reported %s: %s",
        req.randomUnicode, where, err);
    return { 'json': { 'errorLocation': where, 'details': err }};
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
        return { 'error': errs };
    }
    return ret;
};

function parseEvents(memo, evnt) {

    if(evnt.type === 'timeline' && 
       evnt.location !== 'https://www.facebook.com/') {
        debug("Unexpected!? Location %s", evnt.location);
    }

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

function processEvents(req) {

    var ipaddr = _.get(req.headers, "x-forwarded-for") || "127.0.0.1";
    var geoip = utils.getGeoIP(ipaddr);

    var headers = processHeaders(_.get(req, 'headers'), {
        'content-length': 'length',
        'x-fbtrex-build': 'build',
        'x-fbtrex-version': 'version',
        'x-fbtrex-userid': 'supporterId',
        'x-fbtrex-publickey': 'publickey',
        'x-fbtrex-signature': 'signature'
    });
    if(hasError(headers)) 
        return reportError('header parsing, missing', headers.error, req);

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

    debugger;

    var x = signer.verify(JSON.stringify(req.body), bs58.decode(headers.signature), bs58.decode(headers.publickey) );
    var y = signer.verify(JSON.stringify(req.body), signer.util.encodeUTF8(bs58.decode(headers.signature)), signer.util.encodeUTF8(bs58.decode(headers.publickey)) );
    debugger;
    return mongo
        .read(nconf.get('schema').supporters, {
            userId: _.parseInt(headers.supporterId)
        })
        .then(function(supporter) {
            console.log(_.size(req.rawBody));
            debugger;
            debug("%d", _.size(supporter.publicKey));

            if (signer.verify('NaCL is amazing!', signature, publicKey)){
                    console.log('Signature is valid!');
            }
        });


        /* TODO: put this code as part of the bluebird chain */
    var processed = _.reduce(_.get(req, 'body'), parseEvents, {
        'timelines': [],
        'impressions': [],
        'htmls': [],
        'errors': [],
        'sessionInfo': { 
            'numId': _.parseInt(headers.supporterId),
            'geoip': geoip.code,
            'version': headers.version
        }
    });

    if(hasError(processed))
        return reportError('body parsing', processed.error, req);

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

    debug("%s Saving %d impressions %d html %d timelines; user %d from %s ver  %s",
        req.randomUnicode, _.size(processed.impressions),
        _.size(processed.htmls), _.size(processed.timelines),
        headers.supporterId,
        _.isNull(geoip.code) ? geoip.ip : geoip.code, headers.version);

    return Promise
        .all(functionList)
        .tap(function(results) { 
            return mongo.upsertOne(
                nconf.get('schema').supporters,
                { userId: processed.sessionInfo.numId },
                { lastActivity: new Date(moment().toISOString()) }
            );
        })
    .then(function(results) {
        /* maybe here can be refreshed, to the client, userSecret */
        return { "json": { "status": "OK" }};
    })
    .catch(function(errorstr) {
        debug("Exception %s", JSON.stringify(errorstr));
        return { 'json': {
            'errorLocation': 'exception',
            'details': errorstr
        }};
    });
};

module.exports = {
  processEvents: processEvents
};
