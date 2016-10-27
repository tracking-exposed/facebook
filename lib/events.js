var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('api-3');
var os = require('os');
var nconf = require('nconf');
 
var mongo = require('./mongo');
var utils = require('./utils');
var error = require('./error');


var authMiddleWare = function(req) {
    debugger;
    var headers = processHeaders(_.get(req, 'headers'), {
        'x-fbtrex-build': 'build',
        'x-fbtrex-version': 'version',
        'content-length': 'length',
        'x-fbtrex-userid': 'supporterId'
    });

    if(checkError(headers) && false) // XXX
        return manageError('header parsing, missing', headers.error, req);

    req.fbtrexHeaders = headers;

    return (_.random(1,3) === 2)
};

//        displayTime: new Date(tle.when),

/* used in the postFeed APIv3 */
function checkError(retDict) {
    console.log(JSON.stringify(retDict, undefined, 2));
    var err = _.get(retDict, 'error');
    return !_.isUndefined(err);
};

function manageError(where, err, req) {
    debug("%s Error %s: %s", req.randomUnicode, where, error);
    return { 'error': where, 'what': err };
};

/* used in .reduce of postEvents */
var parseEvents = function(memo, tmln) {

    memo.user.numId = _.parseInt(tmln.fromProfile);

    if(tmln.location !== 'https://www.facebook.com/')
        debug("Location %s", tmln.location);

    var newTmln = {
        unique: tmln.uuid,
        refreshTime: new Date(moment(tmln.dt).toISOString()),
        lastPosition: tmln.lastPosition,
        userId: memo.user.numId
    };
    memo.timelines.push(newTmln);

    memo.posts = _.concat(memo.posts, _.map(tmln.posts, function(p) {
        var basic = {
            order: p.position,
            timelineUnique: tmln.uuid,
            displayTime: new Date(moment(p.seenAt).toISOString()),
            type: post.postType,
            meta: []
        };
        return basic;
        /* TODO, add meta: 'via', 'id', 'link', 'source', 'creation' */
    }));

    return memo;
};


/* used to process header of events POSTs */
var processHeaders = function(received, required) {
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



var processEvents = function(req) {

    debug("Headers già presenti %j", req.fbtrexHeaders);

    var processed = _.reduce(_.get(req, 'body'), parseEvents, {
        'timelines': [],
        'posts': [],
        'user': { 'numId': headers.supporterId },
    });

    if(checkError(processed))
        return manageError('body parsing', processed.error, req);

    var ipaddr = _.get(req.headers, "x-forwarded-for") || "127.0.0.1";
    var geoip = utils.getGeoIP(ipaddr);

    if(utils.checkError(processed))
        return utils.manageError(processed, req);

    processed.timelines = _.map(processed.timelines, function(entry) {
        debugger;
        var rId = utils.hash({
            'unique': entry.refreshUnique,
            'user': processed.user.numId
        });
        return {
            refreshTime: new Date(entry.refreshTime),
            geoip: geoip.code,
            userId: processed.user.numId,
            refreshId: rId,
            version: parsedVersion
        };
    });

    processed.timeline = _.map(processed.timeline, function(entry) {
        var rId = utils.hash({
            'unique': entry.refreshUnique,
            'user': processupportInfo.numId
        });
        return _.extend(_.omit(entry, ['refreshUnique']), {
            refreshId: rId,
            userId: supportInfo.numId
        });
    });

    debugger;
    /* completed the parsing section, here the promises list */
    var functionList = [];
    if(processed.anomaly) {
        if( _.parseInt(nconf.get('anomaly')) === 1 ) {
            debug("%s Anomaly detected: saving log", req.randomUnicode);
            functionList.push(
                utils.shmFileWrite(
                    'getPostInfo-' + supportInfo.numId,
                    JSON.stringify({
                        body: req.body,
                        geoip: geoip,
                        user: supportInfo,
                        processed: processed
                    }, undefined, 2))
            );
        } else {
            debug("%s Anomaly been spot -- not saving file", 
                req.randomUnicode);
        }
    }

    /* create new objects in refreshes with all the last info,
     * update the user object with the last interaction
     * update the user object with the number of refreshes-objects */


    debug("%s Saving %d posts %d timelines, user %d ٹ %s ټ %s",
        req.randomUnicode, _.size(processed.posts),
        _.size(processed.timelines), processed.supportInfo.numId,
        _.isNull(geoip.code) ? geoip.ip : geoip.code, 
        headers.version);

    /* this is a pretty nice way to see what you are copying */
    // console.log(JSON.stringify(processed, undefined, 2));

    return Promise.map(processed.timelines, function(tmln) {
        debug("Uploading timeline %j", tmln);
        return mongo.upsertOne(
            nconf.get('schema').timelines,
            { timelineId: tmln.timelineId }, tmln
        );
    })
    .tap(function(results) { 
        return mongo.upsertOne(
            nconf.get('schema').supporters,
            { userId: processed.supportInfo.numId },
            { userId: processed.supportInfo.numId, 
              lastInfo: new Date(moment().format()) }
        );
    })
    .tap(function(results) { 
        if(_.size(processed.posts)) {
            return mongo.writeMany(
                nconf.get('schema').posts,
                processed.posts
            );
        }
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
