var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('api-2');
var os = require('os');
var disk = Promise.promisifyAll(require('diskusage'));
var jade = require('jade');
var nconf = require('nconf');
 
var mongo = require('./mongo');
var utils = require('./utils');
var error = require('./error');

var personalP = jade.compileFile(__dirname + '/../sections/personal.jade');
var overseerP = jade.compileFile(__dirname + '/../sections/overseer.jade');

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

var adminDataView = function(req) {
  /* ID/countBy 
   * http://stackoverflow.com/questions/24761266/select-group-by-count-and-distinct-count-in-same-mongodb-query
   * -- by hand query composition at the moment!
   */
  return Promise
  .all([
      mongo.aggregate(
          'facebook1', 
          {$group: {_id : "$profileId", number: { $sum: 1} }}
      ),
      mongo.aggregate(
          'supporters2', 
          {$group: {_id : "$href", number: { $sum: 1} }}
      ),
      mongo.count('timeline2'),
      mongo.aggregate(
          'refreshes2', 
          {$group: {_id : "$userId", number: { $sum: 1} }}
      ),
      mongo.aggregate(
          'suggestions2', 
          {$group: {_id : "$role", number: { $sum: 1} }}
      )
  ])
  .then(function(results) {
      console.log(JSON.stringify(results, undefined, 2));
      return { json: {
          'facebook1': results[0],
          'supporters': results[1],
          'timeline': results[2],
          'refreshes': results[3],
          'suggestions': results[4]
      }};
  });

  /*  { "_id": profileId, "number": $number } 
   *  .reduce(function(memo, profentry) {
   *      var profileId = _.parseInt(profentry["_id"]);
   *      if(_.isNaN(profileId)) {
   *          debug("%s detect wrong entry in %j ??", req.randomUnicode, 
   *              profentry);
   *          return memo;
   *      }
   *      memo.push({
   *          profileId: profileId,
   *          postCount: profentry["number"]
   *      });
   *      return memo;
   *  }, [])
   */
};

var publicStats = function(req) {
    debug("this is publicStats, play with some cache/weekly stats?");
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

var postFeed = function(req) {

    var ipaddr = _.get(req.headers, "x-forwarded-for") || "127.0.0.1";
    var geoip = utils.getGeoIP(ipaddr);
    var supportInfo = _.get(req.body, 'from');

    if(!_.isUndefined(supportInfo.id))
        supportInfo.numId = _.parseInt(supportInfo.id);

    if(_.isNaN(supportInfo.numId))
        throw new Error("Invalid user received?");

    var refreshes = _.get(req.body, 'timeline');
    var debugStats = _.get(req.body, 'debug');

    if(_.size(debugStats)) {
        debug("Debug stats:");
        console.log(JSON.stringify(debugStats, undefined, 2));
    }

    if(!_.size(refreshes)) {
        debug("%s No timeline received", req.randomUnicode);
        return { "text": "nothing received here?" };
    }

    processed = refreshes.reduce(utils.processContribution, {
        'timeline': [],
        'refreshes': [],
        'current': null
    });

    /* extend the refresh object with session-info and not just 
     * post dependend info */
    var hashMap = {};

    processed.refreshes = _.map(processed.refreshes, function(entry) {
        var rId = utils.hash({
            'unique': entry.refreshUnique,
            'user': supportInfo.numId
        });
        hashMap[entry.refreshUnique] = rId;

        return _.extend(_.omit(entry, ['refreshUnique']), {
            geoip: geoip.code,
            userId: supportInfo.numId,
            refreshId: rId
        });
    });

    processed.timeline = _.map(processed.timeline, function(entry) {
        return _.extend(_.omit(entry, ['refreshUnique']), {
            refreshId: hashMap[entry.refreshUnique],
            userId: supportInfo.numId
        });
    });

    /* create new objects in refreshes with all the last info,
     * update the user object with the last interaction
     * update the user object with the number of refreshes-objects */

    var functionList = [
        mongo.writeOne(
            nconf.get('schema').supporters, { 
                userId: supportInfo.numId, 
                lastInfo: moment().format(),
            }
        ),
        mongo.writeMany(
            nconf.get('schema').timeline,
            processed.timeline
        )
    ];
    if(_.size(processed.refreshes)) {
        functionList.push(
            mongo.writeMany(
                nconf.get('schema').refreshes,
                processed.refreshes
            )
        );
    }
    /* if debug */
    functionList.push(
        utils.JSONsave('/dev/shm', 'processed-pF-' + supportInfo.numId, {
            geoip: geoip,
            user: supportInfo,
            processed: processed
        })
    );
    functionList.push(
        utils.JSONsave('/dev/shm', 'original-pF-' + supportInfo.numId, {
            body: req.body
        })
    );
    /* endif debug */

    debug("%s saving %d TLe (last order %d), user %d (%d debug)", 
        req.randomUnicode, _.size(processed.timeline),
        _.last(processed.timeline).order, supportInfo.numId, 
        _.size(debugStats) );

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

var userTimeLine = function(req) {

    var numId = _.parseInt(req.params.profileId);

    if(_.isNaN(numId))
        throw new Error("Invalid user requested?");

    debug("%s userTimeLine valid request for %d",
        req.randomUnicode, _.size(numId));

    var partialRet;
    return Promise.all([
        mongo.readLimit(nconf.get('schema').refreshes, 
                    {userId: numId}, {refreshTime: -1}, 6),
        mongo.count(nconf.get('schema').refreshes,
                    {userId: numId} )
    ])
    .then(function(results) {
        partialRet = results;
        /* only the refreshes are map-ped */
        return results[0];
    })
    .map(function(refresh) {
        return mongo
            .readLimit(nconf.get('schema').timeline, 
                        {refreshId: refresh.refreshId}, 
                        {postTime: 1}, 20);
    })
    .then(function(timelines) {
        // console.log(JSON.stringify(timelines, undefined, 2));
        return { 'json' : {
            'refreshesAvail': partialRet[1],
            'refreshes': partialRet[0],
            'timelines': timelines
        }};
    });
};

var getPersonal = function(req) {
    var profileId = _.parseInt(req.params.profileId);
    var customInfo;
    debug("%s getPersonal page", req.randomUnicode);
    /* this is the page polling from getSimpleGraph */
    return mongo
        .read(nconf.get('schema').supporters, {profileId: profileId})
        .then(function(user) {
            if( _.isUndefined(user) || user.numberOftimeLine === 0 ) {
                customInfo = {
                    'exists': false,
                    'profileId': 100005961541729,
                    'timelines': 'many',
                    'lastUpdate': 'pretty recently'
                };
            } else {
                debug("%s Invalid profile: return me", req.randomUnicode);
                customInfo = {
                    'exists': true,
                    'profileId': user.profileId,
                    'timelines': user.numberOftimeLine,
                    'lastUpdate': user.lastUpdate
                };
            }
            return { 
                'text': personalP(customInfo) 
            };
        });
};

var getOverseer = function(req) {
    debug("%s getOverseer page", req.randomUnicode);
    /* this is a page polling from getAdminView */
    return { 
        'text': overseerP()
    };
};

var exportNode = function(req) {
    var queryS = req.params.selector === 'all' ? {} : req.params.selector;
    var tableName = req.params.table;

    debug("Selector for exportNode is: %j", queryS);
    return mongo
        .read('facebook1', queryS)
        .then(function(colls) {
            debug("export of the Node content: %d entries", _.size(colls));
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
    adminDataView: adminDataView,
    publicStats: publicStats,
    postFeed: postFeed,
    getPersonal: getPersonal,
    getOverseer: getOverseer,
    userTimeLine: userTimeLine,
    exportNode: exportNode,
    writeContrib: writeContrib
};
