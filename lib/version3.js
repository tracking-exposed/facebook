var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('api-3');
var os = require('os');
var nconf = require('nconf');
 
var mongo = require('./mongo');
var utils = require('./utils');
var error = require('./error');


var postFeed = function(req) {

    var headers = utils.processHeaders(_.get(req, 'headers'), {
        'x-fbtrex-build': 'build',
        'x-fbtrex-version': 'version',
        'content-length': 'length'
    });

    if(utils.checkError(headers))
        return utils.manageError('header parsing', headers.error, req);

    var processed = _.reduce(_.get(req, 'body'), utils.processTimelines, {
        'timelines': [],
        'posts': [],
        'user': { 'numId': null },
    });

    if(utils.checkError(processed))
        return utils.manageError('body parsing', processed.error, req);

    var ipaddr = _.get(req.headers, "x-forwarded-for") || "127.0.0.1";
    var geoip = utils.getGeoIP(ipaddr);

    // processed = utils.validateSignature(processed, headers);
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
  postFeed: postFeed
};
