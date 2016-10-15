var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('api-2');
var os = require('os');
var disk = Promise.promisifyAll(require('diskusage'));
var nconf = require('nconf');
 
var mongo = require('./mongo');
var utils = require('./utils');
var analysis = require('./analysis');
var error = require('./error');
var sharding = require('./sharding');
var c3conv = require('./c3convertors');

var nodeInfo = function(req) {
    /* This API return:
     * +number of refresh/supporters/timeline and define the 'slots' size
     *  (slots are used in /node/export
     * +system stats (loadavg, totalmem, freemem)
     */
    debug("%s nodeInfo", req.randomUnicode);
    return Promise
        .all([
            mongo.countByObject(nconf.get('schema').supporters),
            mongo.countByObject(nconf.get('schema').timeline),
            mongo.countByObject(nconf.get('schema').refreshes),
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
            var promises = _.reduce(desc, function(memo, source) {

                if(_.isNull(source.minMax)) {
                    memo.push(Promise.resolve([]));
                    return memo;
                }
                debug("nodeExtract from %s by %s m %d M %d w/ %d entries",
                    source.name, _.first(_.keys(source.sorter)),
                    source.minMax.min, source.minMax.max, source.objc);

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

var countriesStats = function(req) {
    var format = (req.params.format === 'json') ? 'json' : 'c3';
    debug("%s countriesStats s with format '%s'", req.randomUnicode, format);

    return mongo
        .countByObject(nconf.get('schema').refreshes, {"country": "$geoip"})
        .then(function(countbc) {
            return _.map(countbc, function(centry) {
                return _.extend(centry["_id"], {
                    "number": centry.count
                });
            });
        })
        .then(function(completecc) {
            var cutoff = _.reject(completecc, function(cen) {
                if(_.isNull(cen.country)) {
                    debug(" !country null found (%d entries)", cen.number);
                    return true;
                }
                return _.lt(cen.number, 10);
            });
            debug("%s removed %d countries from %d (now %d)",
                req.randomUnicode, (_.size(completecc) - _.size(cutoff)),
                _.size(completecc), _.size(cutoff));

            if(format === 'json')
                return cutoff;

            /* else, the format is c3 */
            return _.map(cutoff, function(centry) {
                return [ centry.country, centry.number ];
            });
        })
        .then(function(results) {
            return { 'json': results };
        });

};

var countryStatsByDay = function(req) {
    /* number of users by day per nation */
    var format = (req.params.format === 'json') ? 'json' : 'c3';
    var ccode = (req.params.countryCode);
    if(_.size(ccode) !== 2)
        throw new Error("Invalid size of country code");

    debug("%s countryStatsByDay of %s in format '%s'",
        req.randomUnicode, ccode, format);

    return mongo
        .usersByDayByCountry(nconf.get('schema').refreshes,
                             {"geoip": ccode })
        .then(function(lsol) {
            return _.map(lsol, function(d) {
                var when = _.get(d, "_id");
                return { "date": moment(when.year + "-" +
                                        when.month + "-" +
                                        when.day, "YYYY-MM-DD"),
                          "users": _.size(d.usersSeen)
                };
            });
        })
        .then(function(seq) {
            var ord = _.sortBy(seq, 'date');

            if(format === 'json')
                return ord;

            debug("* * * TODO - manage c3");
            return ord;
        })
        .then(function(results) {
            return { 'json': results };
        });
};

var byDayActivity = function(req) {
    /* This is useful only to check only the node status */
    var format = (req.params.format === 'json') ? 'json' : 'c3';
    debug("%s byDayActivity with format '%s'", req.randomUnicode, format);

    var activitySources = [
        { 'name': "supporters",
          'column': nconf.get('schema').supporters,
          'timeVarName': "$lastInfo",
          'description': "Last day of activity"
        },
        { 'name': "timeline",
          'column': nconf.get('schema').timeline,
          'timeVarName': "$displayTime",
          'description': "Number of posts parsed and stored"
        },
        { 'name': "refreshes",
          'column': nconf.get('schema').refreshes,
          'timeVarName': "$refreshTime",
          'description': "Number of facebook' Feed refreshes recorded"
        }
    ];

    return Promise.map(activitySources, function(aS) {
        return mongo.countByDay(aS.column, aS.timeVarName, {});
    })
    .then(function(unassociated) {
        return _.map(unassociated, function(lists, ndx) {
            var reference = _.nth(activitySources, ndx);
            var stats = utils.statsReshape(lists);
            /* special, only on 'supporters' cut off the last day */
            if(reference.name === "supporters") {
                stats = _.take(stats, _.size(stats) -1);
            }
            return {
                'name': reference.name,
                'what': reference.description,
                'stats': stats
            };
        })
    })
    .then(function(results) {
        return mongo
            .usersByDay(nconf.get('schema').timeline)
            .then(function(x) {
                var usersActivities = {
                    'name': "users",
                    'what': "Number of active users per day",
                    'stats': utils.activeUserCount(x)
                };
                results.push(usersActivities);
                return results;
            });
    })
    .then(function(results) {
        var retVal = { json: results };
        if(format === 'c3') {
          retVal = c3conv.statsToC3(retVal, {});
        }
        return retVal;
    });
};

var userAnalysis = function(req) {
    var format = (req.params.format === 'json') ? 'json' : 'c3';
    var kind = String(req.params.kind);
    var consideredP = _.parseInt(req.params.cpn);
    var filter = { "userId": _.parseInt(req.params.userId) };

    if(_.isNaN(filter.userId) || _.isNaN(consideredP))
        throw new Error("Invalid userId or consideredP");

    debug("%s userAnalysis [%s] format %s for %j posts-space %d",
          req.randomUnicode, kind, format, filter, consideredP);

    switch(kind) {
        case 'presence':
            var apromise = analysis.estimateUserPresence(filter, consideredP)
            break;
        case 'absolute':
            var apromise = analysis.absolutePostList(filter, consideredP);
            break;
        default:
            throw new Error("developer check this wrong kind: ["+kind+"]");
    };

    return Promise
        .resolve(apromise)
        .then(function(ret) {
            if(format === 'c3') {
                var convertor = {
                    'presence': c3conv.presenceToC3,
                    'absolute': c3conv.absoluteToC3
                };
                return { 'json': convertor[kind](ret) };
            }
            else {
                return { 'json': ret };
            }
        });
};


var postLife = function(req) {
    /* not used, probably meaningful only if realitycheck is extended */
    var postId = _.parseInt(req.params.postId);
    var userId = _.parseInt(req.params.userId);

    if( _.isNaN(postId) || _.isNaN(userId) )
        throw new Error("NaN postId || userId");
    debug("%s PostLife user %d post %d",
        req.randomUnicode, userId, postId);

    return mongo
        .read( nconf.get('schema').timeline,
               { postId: postId, userId: userId }, {"$displayTime": 1})
        .then(function(result) {
            return {
                'json': utils.stripMongoId(result)
            };
        });
};

var postReality = function(req) {
    /* To get the real picture of a post visibility, we need to get
     * all the access an user had, because the lack of visualisation is
     * itself an information. This is the reason why this API has
     * a chain of query */
    var postId = _.parseInt(req.params.postId);
    if(_.isNaN(postId))
        throw new Error("not a postId received?");
    debug("%s postReality %d", req.randomUnicode, postId);

    return Promise.all([
        mongo
          .getPostRelations(nconf.get('schema').timeline, {postId: postId}),
        mongo
          .read(nconf.get('schema').timeline, {postId: postId})
    ])
    .then(function(results) {
        var postPresence =  utils.stripMongoId(_.last(results));
        var relations = _.first(utils.topPostsFixer(_.first(results)));
        /* time range is 'creationTime' and 'last display + 2 minutes */
        var begin = moment(_.first(postPresence).creationTime);

        if(_.isUndefined(relations.last)) {
            console.log("Error! " + JSON.stringify(results));
            error.reportError({
                'when': moment(),
                'function': 'postFeed',
                'version': parsedVersion,
                'info': results,
            });
            throw new Error("Unknown");
        }
        var end = moment(relations.last).add(2, 'minutes');
        return _.map(relations.users, function(userId) {
            return {
                userId: userId,
                postPres: postPresence,
                begin: begin,
                end: end
            };
        });
    })
    .map(function(info) {
        return mongo.read(nconf.get('schema').refreshes, {
            "userId": info.userId, "refreshTime": {
                "$gt" : new Date(info.begin),
                "$lt": new Date(info.end)
            }
        }, {})
        .map(function(refByU) {
            var x = _.find(info.postPres, { refreshId: refByU.refreshId });
            var ref = moment(refByU.refreshTime).toISOString();
            if(_.isUndefined(x)) {
                return {
                    refreshTime: ref,
                    presence: false,
                    userId: refByU.userId
                };
            }
            return {
                refreshTime: ref,
                presence: true,
                order: x.order,
                type: x.type,
                userId: refByU.userId
            };
        });
    })
    .then(function(layered) {
        var flat = _.flatten(layered);
        debug("realityMeter: Got %d input points for %d users",
            _.size(flat), _.size(layered));
        return { 'json': flat };
    })
    .catch(function(error) {
        return { 'error': 'postId not found' };
    });
};

/* debug piece of content are unlinked from the user, so I can re-parse
 * these piece of HTML without knowing who send it */
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

    // handy to print the received content from the client
    // console.log(JSON.stringify(refreshes, undefined, 2));

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
    var numId = _.parseInt(req.params.userId);
    var past = _.parseInt(req.params.past);
    var refreshes_N = _.parseInt(req.params.R);
    var posts_N = _.parseInt(req.params.P);

    if(_.isNaN(numId) || _.isNaN(refreshes_N) || _.isNaN(posts_N) )
        throw new Error("Invalid user requested?");

    debug("%s userTimeLine valid request for %d (Ref %d, Posts %d)",
        req.randomUnicode, numId, refreshes_N, posts_N);

    /* if not the same of the default, log it as anomaly/good to know */
    var retVal = { 'json' : {} };

    return Promise.all([
        mongo.readLimit(nconf.get('schema').refreshes,
                    { userId: numId },
                    { refreshTime: -1 },
                    refreshes_N, past ),
        mongo.countByObject(nconf.get('schema').refreshes, {userId:numId })
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
                        {order: 1}, posts_N, 0);
    })
    .map(utils.stripMongoId)
    .then(function(timelines) {
        retVal.json.timelines = timelines;
        return retVal;
    });
};

module.exports = {
    nodeInfo: nodeInfo,
    nodeExport: nodeExport,
    countriesStats: countriesStats,
    countryStatsByDay: countryStatsByDay,
    byDayActivity: byDayActivity,
    userAnalysis: userAnalysis,
    postReality: postReality,
    postLife: postLife,
    postFeed: postFeed,
    postDebug: postDebug,
    userTimeLine: userTimeLine
};
