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

var adminStats = function(req) {
    /* TODO auth, TODO more info */
    return publicStats(req)
        .then(function(retVal) {
            retVal.json.loadavg = os.loadavg();
            retVal.json.totalmem = os.totalmem();
            retVal.json.freemem = os.freemem();
            debug("adminStats: %j", retVal);
            return retVal;
        });
};

var adminView = function(req) {
    /* ID/countBy
     * http://stackoverflow.com/questions/24761266/select-group-by-count-and-distinct-count-in-same-mongodb-query
     * -- by hand query composition at the moment!
     */
    return Promise
      .all([
          mongo.aggregate(
            'facebook1',
            {$group: {_id: "$profileId", number: {$sum: 1}}}
          ),
          mongo.aggregate(
            'supporters2',
            {$group: {_id: "$href", number: {$sum: 1}}}
          ),
          mongo.count('timeline2'),
          mongo.aggregate(
            'refreshes2',
            {$group: {_id: "$userId", number: {$sum: 1}}}
          ),
          mongo.aggregate(
            'suggestions2',
            {$group: {_id: "$role", number: {$sum: 1}}}
          )
      ])
      .then(function (results) {
          return {
              json: {
                  'facebook1': results[0],
                  'supporters': results[1],
                  'timeline': results[2],
                  'refreshes': results[3],
                  'suggestions': results[4]
              }
          };
      });
};

var publicStats = function(req) {
    debug("%s publicStats", req.randomUnicode);
    return Promise
        .all([
            mongo.count('facebook1'),
            mongo.count('supporters2'),
            mongo.count('timeline2'),
            mongo.count('refreshes2'),
            mongo.count('suggestions2'),
            disk.checkAsync('/')
        ])
        .then(function(numbers) {
            return {
                json: {
                    legacy: numbers[0],
                    users: numbers[1],
                    posts: numbers[2],
                    refreshes: numbers[3],
                    feedback: numbers[4],
                    disk: numbers[5]
                }
            };
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
    return mongo.read( nconf.get('schema').timeline, {postId: postId})
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
    debug("%s parse error reported, saving files",
        req.randomUnicode);
    /* do no save in the DB, only in a file written in /dev/shm,
     * it enter in our debug procedure and then forget */
    // TODO increment number of error per day on mongo
    return Promise.resolve(
        utils.shmFileWrite('unparsedHTML', JSON.stringify(parsedError))
    )
    .then(function() {
        return { 'json': 'OK' };
    });
};

var postFeed = function(req) {
    var ipaddr = _.get(req.headers, "x-forwarded-for") || "127.0.0.1";
    var geoip = utils.getGeoIP(ipaddr);
    var supportInfo = _.get(req.body, 'from');

    if(_.isUndefined(_.get(supportInfo, 'id')))
        throw new Error("lack of supportInfo.id");

    supportInfo.numId = _.parseInt(supportInfo.id);

    if(_.isNaN(supportInfo.numId))
        throw new Error("Invalid user Id received");

    var refreshes = _.get(req.body, 'timeline');

    if(!_.size(refreshes)) {
        debug("%s No timeline received", req.randomUnicode);
        return { "text": "nothing received here?" };
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
        return _.extend(entry, {
            geoip: geoip.code,
            userId: supportInfo.numId,
            refreshId: rId,
            version: _.get(req.body, 'version')
        });
    });

    processed.timeline = _.map(processed.timeline, function(entry) {
        var rId = utils.hash({
            'unique': entry.refreshUnique,
            'user': supportInfo.numId
        });
        return _.extend(entry, {
            refreshId: rId,
            userId: supportInfo.numId
        });
    });

    /* completed the parsing section, here the promises list */
    var functionList = [];
    if(processed.anomaly) {
        if( _.parseInt(nconf.get('anomaly')) === 1 ) {
            debug("%s ESCVI parsing anomaly detected: saving log",
                req.randomUnicode);
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
            debug("%s An anomaly has been spot, but ENV var skip log", 
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
                { userId: supportInfo.numId, lastInfo: moment().format() }
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


    debug("%s saving %d TLe %d Ref, user %d (nation %s)",
        req.randomUnicode, _.size(processed.timeline),
        _.size(processed.refreshes), supportInfo.numId,
        _.isNull(geoip.code) ? geoip.ip : geoip.code );

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
                'version': 1,
                'info': results,
            });
            throw new Error("Unknown");
        }
    });
};

/* take last six refreshes and 20 first post per refresh */
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

var userTimeLineCSV = function(req) {

    debug("%s userTimeLineCSV", req.randomUnicode);

    var picker = function(jstruct, tl, tndx) {

        if(_.isUndefined(jstruct[tl]) || _.isUndefined(jstruct[tl][tndx]) )
            return '';

        var O = jstruct[tl][tndx];
        if (_.isNaN(O.postId))
            debug("%s userTimeLineCSV NaN postId → %j", 
                req.randomUnicode, O);

        return _.isNaN(O.postId) ? '"'+O.href+'"' : '"'+
            O.postId % 200
            + '"';
    };

    return userTimeLine(req).then(function (jsonAnswer) {
        var ref = _.get(jsonAnswer, 'json.refreshes');
        var timel = _.get(jsonAnswer, 'json.timelines');
        var lines = [];

        lines[0] = _.reduce(ref, function(memo, refr) {
            memo.push('"' + 
                moment(refr.refreshTime).format('dd/hh:mm') 
                + '"');
            return memo;
        }, []);

        _.times(20, function(ndx) {
            _.times(6, function(i) {
                if(_.isUndefined(lines[ndx+1]))
                    lines[ndx+1] = [];

                debugger;
                lines[ndx+1][i] = picker(timel, i, ndx);
            });
        });
        
        return {
            'text': _.map(lines, function(line) {
                return line.join(",");
            }).join("\n")
        };
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

var exportNode = function(req) {
    var queryS = req.params.selector === 'all' ? {} : req.params.selector;
    debug("exportNode: queryS ignored because the table are two");
    var tableName = req.params.table;

    return Promise.all([
        mongo
        .read(nconf.get('schema').timeline, {})
        .read(nconf.get('schema').refreshes, {})
    ])
    .then(function(colls) {
        debug("export of the Node content: %d TL %d RF", 
            _.size(colls[0]), _.size(colls[1]) );
        return {
            json: colls
        }
    });
};

var writeContrib = function(req) {
    debug("TODO writeContrib");
};

module.exports = {
    adminStats: adminStats,
    adminView: adminView,
    publicStats: publicStats,
    publicTopPosts: publicTopPosts,
    publicPostReality: publicPostReality,
    postFeed: postFeed,
    postDebug: postDebug,
    userTimeLine: userTimeLine,
    userTimeLineCSV: userTimeLineCSV,
    userStats: userStats,
    exportNode: exportNode,
    writeContrib: writeContrib
};
