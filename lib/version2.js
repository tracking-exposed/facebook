var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('api-2');
var os = require('os');
var disk = Promise.promisifyAll(require('diskusage'));
var nconf = require('nconf');
 
var mongo = require('./mongo');
var utils = require('./utils');
var error = require('./error');
var sharding = require('./sharding');

var nodeInfo = function(req) {
    /* This API return:
     * +number of refresh/supporters/timeline and define the 'slots' size
     *  (slots are used in /node/export
     * +system stats (loadavg, totalmem, freemem)
     */
    debug("%s nodeInfo", req.randomUnicode);
    return Promise
        .all([
            mongo.count(nconf.get('schema').supporters),
            mongo.count(nconf.get('schema').timeline),
            mongo.count(nconf.get('schema').refreshes),
            disk.checkAsync('/')
        ])
        .then(function(numbers) {

            var columnsSizes = {
                supporters: numbers[0],
                timeline: numbers[1],
                refreshes: numbers[2]
            };

            return {
                json: {
                    columns: columnsSizes,
                    shards: sharding.estimate(columnsSizes),
                    shardMaxElements: sharding.maxElements,
                    disk: numbers[3],
                    loadavg: os.loadavg(),
                    totalmem: os.totalmem(),
                    freemem: os.freemem()
                }
            };
        });
};

var nodeExport = function(req) {

    var shard = _.parseInt(req.params.shard);
    if(_.isNaN(shard))
        throw new Error("not a numeric shard received?");
    debug("%s nodeInfo with on shard %d", req.randomUnicode, shard);
    var retVal = { json: { description: null, exported: null }};

    return nodeInfo(req)
        .then(function(stats) {
            /* these will be used below as sorted by mongo */
            var sorters = {
                supporters: {"$lastInfo": 1},
                timeline: {"$displayTime": 1},
                refreshes: {"$refreshTime": 1}
            };
            debug("nodeInfo: %s",
                JSON.stringify(stats.json, undefined, 2));
            return _.map(stats.json.columns, function(objectN, columnN) {
                return {
                    'name': columnN,
                    'minMax': sharding.minMax(objectN, shard),
                    'sorter': _.get(sorters, columnN),
                    'objc': objectN
                };
            });
        })
        .tap(function(desc) {
            retVal.json.description = desc;
        })
        .then(function(desc) {
            debug("exportDescription: %s",
                JSON.stringify(desc, undefined, 2));
            var promises = _.reduce(desc, function(memo, source) {

                if(_.isNull(source.minMax)) {
                    memo.push(Promise.resolve([]));
                    return memo;
                }
                debug(" nodeExtract from %s by %j mM %j having %d entries",
                    source.name, source.sorter, source.minMax, source.objc);

                memo.push(
                    mongo.readShard( nconf.get('schema')[source.name],
                      source.sorter, source.minMax.min, source.minMax.max)
                );
                return memo;
            }, []);

            if(!_.size(promises))
                return null;

            return Promise
                .all(promises)
                .map(utils.stripMongoId);
        })
        .then(function(cleaned) {
            retVal.json.exported = cleaned;
            return retVal;
        });
};

var nodeActivity = function(req) {

    var activitySources = [
        { 'name': 'supporters',
          'column': nconf.get('schema').supporters,
          'timeVarName': "$lastInfo",
          'description': "Grouped by last day of activity"
        },
        { 'name': 'timeline',
          'column': nconf.get('schema').timeline,
          'timeVarName': "$displayTime",
          'description': "Number of posts parsed and stored"
        },
        { 'name': 'refreshes',
          'column': nconf.get('schema').refreshes,
          'timeVarName': "$refreshTime",
          'description': "Number of facebook' Feed refreshes recorded"
        }
    ];

    debug("%s nodeActivity computed from %j columns", req.randomUnicode, 
        _.map(activitySources, _.pick('name')) );

    return Promise.map(activitySources, function(aS) {
        return mongo.countByDay(aS.column, aS.timeVarName);
    })
    .then(function(unassociated) {
        return _.map(unassociated, function(lists, ndx) {
            var reference = _.nth(activitySources, ndx);
            return {
                'name': reference.name,
                'what': reference.description,
                'stats': utils.statsReshape(lists)
            };
        })
    })
    .then(function(results) {
        return {
            json: results
        }
    });
};

var publicTopPosts = function(req) {
    var EXAMPLES_LIMIT = 20;
    debug("%s publicTopPosts limit %d", req.randomUnicode, EXAMPLES_LIMIT);
    return mongo.aggregate(
              nconf.get('schema').timeline,
              {$group: {_id: "$postId", number: {$sum: 1}}})
          .then(function(results) {
              var rv = _.map(_.takeRight(
                              _.sortBy(results, function(e) { 
                                  return e.number;
                              }),
                              EXAMPLES_LIMIT), function(ent) {
                                  return {
                                      'postId': ent["_id"],
                                      'number': ent["number"]
                                  };
                       });
              return {
                  'json': rv
              };
          });
};

var publicPostReality = function(req) {
    var postId = _.parseInt(req.params.postId);
    if(_.isNaN(postId))
        throw new Error("not a postId received?");
    debug("%s publicPostReality %d", req.randomUnicode, postId);
    return mongo
        .read( nconf.get('schema').timeline, {postId: postId})
        .then(function(result) {
            return {
                'json': utils.stripMongoId(result)
            };
        });
};

/* debug piece of content are unlinked from the user, so I can re-parse
 * these piece of HTML without knowing who received it */
var postDebug = function(req) {
    var parsedError = req.body;
    var parsedVersion = utils.versionParse(_.get(req.body, 'version'));
    debug("%s Client side parsing error received (%s), saving file",
        req.randomUnicode, parsedVersion);
    /* do no save in the DB, only in a file written in /dev/shm,
     * it enter in our debug procedure and then forget */
    // TODO increment number of error per day on mongo
    return Promise.resolve(
        utils.shmFileWrite('unparsedHTML', JSON.stringify(parsedError))
    )
    .then(function() {
        return { 
            'json': {
                'debug': 'OK', 
                'received': _.size(req.body)
            }
        };
    });
};

var postFeed = function(req) {
    var ipaddr = _.get(req.headers, "x-forwarded-for") || "127.0.0.1";
    var geoip = utils.getGeoIP(ipaddr);
    var supportInfo = _.get(req.body, 'from');
    var anomaly = false;

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

/* take last $N refreshes and $Y first post per refresh */
var userTimeLine = function(req) {
    var numId = _.parseInt(req.params.profileId);
    var past = _.parseInt(req.params.past);
    var REFRESH_NUMBER = 6;
    var POST_NUMBER = 30;

    if(_.isNaN(numId))
        throw new Error("Invalid user requested?");

    debug("%s userTimeLine valid request for %d",
        req.randomUnicode, numId);

    var retVal = { 'json' : {} };

    return Promise.all([
        mongo.readLimit(nconf.get('schema').refreshes, 
                    { userId: numId },
                    { refreshTime: -1 },
                    REFRESH_NUMBER, past ),
        mongo.count(nconf.get('schema').refreshes,
                    {userId: numId} )
    ])
    .then(function(results) {
        /* side effects */
        retVal.json.refreshAvailable = _.tail(results);
        retVal.json.refreshes = utils.stripMongoId(_.first(results));
        /* only the refreshes are map-ped below */
        return _.first(results);
    })
    .map(function(refresh) {
        return mongo
            .readLimit(nconf.get('schema').timeline, 
                        {refreshId: refresh.refreshId}, 
                        {order: 1}, POST_NUMBER, 0);
    })
    .then(function(timelines) {
        retVal.json.timelines = _.map(timelines, function(singletl) {
            return utils.stripMongoId(singletl);
        });
        return retVal;
    });
};

/* aggregate of each refresh */
var userStats = function(req) {

    var numId = _.parseInt(req.params.profileId);
    var past = _.parseInt(req.params.past);

    if(_.isNaN(numId))
        throw new Error("Invalid user requested?");

    debug("%s userStats valid request for %d",
        req.randomUnicode, numId);

    return Promise.all([
        mongo.readLimit(nconf.get('schema').refreshes, 
                    {userId: numId}, {refreshTime: -1}, 1, past),
        mongo.count(nconf.get('schema').refreshes, {userId: numId} ),
        mongo.count(nconf.get('schema').timeline, {userId: numId} )
    ]).then(function(results) {
        return {
            'json': {
                lastRefresh: _.first(results[0]).refreshTime,
                refreshes: results[1],
                posts: results[2]
            }
        };
    });

};


var writeContrib = function(req) {
    debug("TODO writeContrib");
};

module.exports = {
    nodeInfo: nodeInfo,
    nodeExport: nodeExport,
    nodeActivity: nodeActivity,
    publicTopPosts: publicTopPosts,
    publicPostReality: publicPostReality,
    postFeed: postFeed,
    postDebug: postDebug,
    userTimeLine: userTimeLine,
    userStats: userStats,
    writeContrib: writeContrib
};
