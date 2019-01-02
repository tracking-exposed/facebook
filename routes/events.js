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

function hasError(retDict) {
    return (!_.isUndefined(_.get(retDict, 'error')));
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

    debug("Unexpected type: %s, abort", evnt.type);

    if (typeof memo.error === 'undefined') {
        memo.error = [];
    }

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
        return debug("Error in processing event: %s", processed.error);

    var functionList = [];

    if(_.size(processed.htmls))
        functionList.push(
                mongo
            .writeMany(nconf.get('schema').htmls, processed.htmls)
            .return({
                'kind': 'htmls',
                'amount': _.size(processed.htmls)
            })
        );

    if(_.size(processed.impressions))
        functionList.push(
                mongo
            .writeMany(nconf.get('schema').impressions,processed.impressions)
            .return({
                'kind': 'impressions',
                'amount': _.size(processed.impressions)
            })
        );

    if(_.size(processed.timelines))
        functionList.push(
                mongo
            .writeMany(nconf.get('schema').timelines, processed.timelines)
            .return({
                'kind': 'timelines',
                'amount': _.size(processed.timelines)
            })
        );

    functionList.push(
        mongo
            .updateOne(nconf.get('schema').supporters, {
                    publicKey: supporter.publicKey,
                    userId: _.parseInt(supporter.userId)
                },
                _.set(supporter, 'lastActivity',
                    new Date(moment().toISOString()))
             )
    );

    var processed_timelines = 0
    var processed_impressions = 0
    var processed_html = 0
    
    /* this big debug noise is handy on the server */
    if(processed.timelines && processed.timelines[0] && processed.timelines[0].nonfeed)
        debug(" * non-newsfeed navigation: no content received");
    else{
    processed_timelines = _.size(processed.timelines)
    processed_impressions =  _.size(processed.impressions)
    processed_html = _.size(processed.htmls)
        
        debug(" * %d timelines %d impressions %d html %s",
          processed_timelines,
          processed_impressions,
          processed_html,
            _.get(processed.timelines[0], 'tagId') ?
                "tagId " + processed.timelines[0].tagId :
                ""
            );
    }
    
    debug(" * user %d [%s] last activity %s (%s ago) %s",
        supporter.userId, geoinfo,
        moment(supporter.lastActivity).format("HH:mm DD/MM"),
        moment.duration(moment.utc()-moment(supporter.lastActivity)).humanize(),
          supporter.version);
    
    var ts = Math.round((new Date()).getTime() / 1000);

    echoes.echo({
        id: ts,
        index: "fbtrex_users",
        support_id: supporter.userId,
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

    if(hasError(headers))
        return debug("header parsing, missing: %s", headers.error);

    return mongo
        .read(nconf.get('schema').supporters, {
            userId: _.parseInt(headers.supporterId),
            publicKey: headers.publickey
        })
        // TODO: we can remove the next `.tap` by delegating the uniqueness
        // check to MongoDB. We can achieve this by creating a compound key
        // db.supporters.createIndex( { "userId": 1, "publicKey": 1 } )
        .then(function(supporterL) {
            if(!_.size(supporterL)) {
                var content = {
                    userId: _.parseInt(headers.supporterId),
                    publicKey: headers.publickey,
                    userSecret: utils.hash({
                        publicKey: headers.publicKey,
                        userId: headers.supporterId,
                        when: moment().toISOString()
                    }),
                    keyTime: new Date(),
                    lastActivity: new Date(),
                    tofu: true
                };
                debug("missing supporter %j: TOFU!", content);
                return mongo
                    .writeOne(nconf.get('schema').supporters, content)
                    .return( [ content ] )
            }
            return supporterL;
        })
        .tap(function(supporterL) {
            if(_.size(supporterL) > 1)
                debug("Error: report this error %j -- duplicated supporter", supporterL);
        })
        .then(_.first)
        .then(function(supporter) {
            if(!_.every([ headers.signature, supporter.publicKey], _.size)) {
                debug("Validation fail: signed %s retrieved pubkey %s",
                    headers.signature, supporter.publicKey);
                throw new Error("Signature can't be verify");
            }
            if (!utils.verifyRequestSignature(req)) {
                debug("Verification fail: signed %s pubkey %s user %d",
                    headers.signature, supporter.publicKey, supporter.userId);
                throw new Error('Signature does not match request body');
            }
            /* verification went well! */

            if(supporter.version !== headers.version) {
                debug("Supporter %d version upgrade %s to %s",
                    supporter.userId, supporter.version, headers.version);
            }
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
