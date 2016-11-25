var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('events');
var os = require('os');
var nconf = require('nconf');
 
var mongo = require('./mongo');
var utils = require('./utils');
var error = require('./error');

function authMiddleWare(req) {
    var headers = processHeaders(_.get(req, 'headers'), {
        'content-length': 'length',
        'x-fbtrex-build': 'build',
        'x-fbtrex-version': 'version',
        'x-fbtrex-userid': 'supporterId',
        'x-fbtrex-publickey': 'publickey',
        'x-fbtrex-signature': 'signature'
    });
    if(checkError(headers)) 
        return manageError('header parsing, missing', headers.error, req);
    req.fbtrexHeaders = headers;

    /* return undefined means no error */
    return undefined;

    /* special: to use operations/stressTest.js with valid
     * headers/body, comment the return above, save the payload received 
     * and read operations/README.md */
    return utils
        .shmFileWrite('stressTest', JSON.stringify({
                                        headers: req.headers,
                                        body: req.body
        }))
        .return(undefined);
};

function checkError(retDict) {
    var err = _.get(retDict, 'error');
    if(!_.isUndefined(err)) {
        debug("Errors: %j", err);
    }
    return (!_.isUndefined(err));
};

function manageError(where, err, req) {
    debug("%s Error %s: %s", req.randomUnicode, where, error);
    return { 'error': where, 'what': err };
};

function parseEvents(memo, evnt) {

    if(evnt.type === 'timeline' && 
       evnt.location !== 'https://www.facebook.com/')
        debug("Location %s", evnt.location);

    if(evnt.type === 'timeline') {
        newTmln = {};
        newTmln.startTime = new Date(evnt.startTime);
        newTmln.userId = memo.sessionInfo.numId;
        newTmln.geoip = memo.sessionInfo.geoip;
        newTmln.id = utils.hash({
            'uuid': evnt.id,
            'user': newTmln.userId
        });
        memo.timelines.push(newTmln);
        return memo;
    }

    if(evnt.type === 'impression') {
        var newPost = _.pick(evnt, 
                        ['visibility', 'impressionTime', 'impressionOrder',
                         'timelineId', 'html' ] );

        newPost.impressionTime = new Date(evnt.impressionTime);

        if(_.eq(newPost.visibility, 'public')) {

            if(!_.size(newPost.html)) {
                debug("Strange: public impression with zero size HTML?");
                return memo;
            }

            newPost.htmlId = utils.hash({ 'html': newPost.html });

            var snippet = {
                savingTime: new Date(moment().toISOString()),
                id: newPost.htmlId,
                html: newPost.html
            };
            memo.htmls.push(snippet);
        } else if( _.size(newPost.html) )
            debug("Warning: private post leakage! %d", _.size(newPost.html));

        memo.impressions.push(_.omit(newPost, ['html']));
        return memo;
    }

    debug("Error? Invalid kind of 'type': %s", evnt.type);
    memo.errors.push({
        'kind': "invalid type",
        'event': evnt
    });
    return memo;
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

function processEvents(req) {

    var ipaddr = _.get(req.headers, "x-forwarded-for") || "127.0.0.1";
    var geoip = utils.getGeoIP(ipaddr);

    var processed = _.reduce(_.get(req, 'body'), parseEvents, {
        'timelines': [],
        'impressions': [],
        'htmls': [],
        'errors': [],
        'sessionInfo': { 
            'numId': req.fbtrexHeaders.supporterId,
            'geoip': geoip.code,
            'version': req.fbtrexHeaders.version
        }
    });

    if(checkError(processed))
        return manageError('body parsing', processed.error, req);

    var functionList = [];
    
    if(_.size(processed.htmls))
        functionList.push(
            mongo.writeMany(nconf.get('schema').htmls, processed.htmls)
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

    debug("%s Saving %d impressions %d html %d timelines, user %d ٹ %s ټ %s",
        req.randomUnicode, _.size(processed.impressions),
        _.size(processed.htmls), _.size(processed.timelines),
        req.fbtrexHeaders.supporterId,
        _.isNull(geoip.code) ? geoip.ip : geoip.code, 
        req.fbtrexHeaders.version);

    return Promise
        .all(functionList)
        .tap(function(results) { 
            return mongo.upsertOne(
                nconf.get('schema').supporters,
                { userId: req.fbtrexHeaders.supporterId },
                { userId: req.fbtrexHeaders.supporterId,
                  lastInfo: new Date(moment().format()) }
            );
        })
    .then(function(results) {
        return { "json": { "status": "OK" }};
    })
    .catch(function(errorstr) {
        console.log("Error! " + JSON.stringify(errorstr));
        return { 'error': errorstr };
    });
};

module.exports = {
  processEvents: processEvents,
  authMiddleWare: authMiddleWare
};
