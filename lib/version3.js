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
    var ipaddr = _.get(req.headers, "x-forwarded-for") || "127.0.0.1";
    var geoip = utils.getGeoIP(ipaddr);
    var supportInfo = _.get(req.body, 'from');
    var anomaly = false;

    debugger;
    if(_.isUndefined(_.get(supportInfo, 'id'))) {
        debug("%s Fatal error? lack of supportInfo.id", req.randomUnicode);
        anomaly = true;
    } else {
        supportInfo.numId = _.parseInt(supportInfo.id);

        if(_.isNaN(supportInfo.numId)) {
            debug("%s Fatal error ? Not an userId", req.randomUnicode);
            anomaly = true;
        }
    }

    var refreshes = _.get(req.body, 'timeline');
    var parsedVersion = utils.versionParse(_.get(req.body, 'version'));

    if(!_.size(refreshes)) {
        debug("%s No timeline received", req.randomUnicode);
        anomaly = true;
    }

    if (anomaly) {
        return Promise.resolve(
            utils.shmFileWrite('Anomaly-', JSON.stringify(req.body) )
        ).then(function() {
            return { 'json': 'Anomaly !?' };
        });
    }

    processed = refreshes.reduce(utils.processContribution, {
        'timeline': [],
        'refreshes': [],
        'anomaly': false
    });

    processed.refreshes = _.map(processed.refreshes, function(entry) {
        var rId = utils.hash({
            'unique': entry.refreshUnique,
            'user': supportInfo.numId
        });
        return {
            refreshTime: new Date(entry.refreshTime),
            geoip: geoip.code,
            userId: supportInfo.numId,
            refreshId: rId,
            version: parsedVersion
        };
    });

    processed.timeline = _.map(processed.timeline, function(entry) {
        var rId = utils.hash({
            'unique': entry.refreshUnique,
            'user': supportInfo.numId
        });
        return _.extend(_.omit(entry, ['refreshUnique']), {
            refreshId: rId,
            userId: supportInfo.numId
        });
    });

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

    if(_.size(processed.timeline)) {
        functionList = [
            mongo.updateOne(
                nconf.get('schema').supporters,
                { userId: supportInfo.numId },
                { userId: supportInfo.numId, 
                  lastInfo: new Date(moment().format()) }
            ),
            mongo.writeMany(
                nconf.get('schema').timeline,
                processed.timeline
            )
        ];
    } else
        debug("%s No timeline here !?", req.randomUnicode);

    if(_.size(processed.refreshes)) {
        functionList.push(
            mongo.writeMany(
                nconf.get('schema').refreshes,
                processed.refreshes
            )
        );
    } else 
        debug("%s This is an update of an existing refresh",
            req.randomUnicode);

    debug("%s Saving %d TLe %d Ref, user %d ٹ %s ټ %s",
        req.randomUnicode, _.size(processed.timeline),
        _.size(processed.refreshes), supportInfo.numId,
        _.isNull(geoip.code) ? geoip.ip : geoip.code, parsedVersion);

    /* this is a pretty nice way to see what you are copying */
    // console.log(JSON.stringify(processed, undefined, 2));

    return Promise.all(functionList)
    .then(function(results) {
        if(results.reduce(function(m, retv) { return m & retv }, true)) {
            return { "json": { "status": "OK" }};
        } else {
            console.log("Error! " + JSON.stringify(results));
            error.reportError({
                'when': moment(),
                'function': 'postFeed',
                'version': parsedVersion,
                'info': results,
            });
            throw new Error("Unknown");
        }
    });
};

module.exports = {
  postFeed: postFeed
};

