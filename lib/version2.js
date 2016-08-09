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
   */
  var query = {$group: {_id : "$profileId", number: { $sum: 1} }}
  return mongo
      .aggregate('facebook1', query)
      .reduce(function(memo, profentry) {
          /* { "_id": profileId, "number": $number } */
          var profileId = _.parseInt(profentry["_id"]);
          if(_.isNaN(profileId)) {
              debug("%s detect wrong entry in %j ??", req.randomUnicode, 
                  profentry);
              return memo;
          }
          memo.push({
              profileId: profileId,
              postCount: profentry["number"]
          });
          return memo;
      }, [])
      .then(function(collection) {
          return {
              json: collection
          };
      });
};

var publicStats = function(req) {
    debug("this is publicStats, play with some cache/weekly stats?");
    return Promise
        .all([
            mongo.count('facebook1'),
            disk.checkAsync('/')
        ])
        .then(function(numbers) {
            return {
                json: {
                    tlentries: numbers[0],
                    disk: numbers[1]
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

    debug("%s The feed importing start, user %d (%d TLe)(%d debug)", 
        req.randomUnicode, supportInfo.numId, 
        _.size(refreshes), _.size(debugStats) );

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

    processed.refreshes.map(function(entry) {
        return _.extend(entry, {
            geoip: geoip.code,
            userId: supportInfo.numId
        });
    });

    /* create new objects in refreshes with all the last info,
     * update the user object with the last interaction
     * update the user object with the number of refreshes-objects */
    return Promise.all([
        mongo.updateOne(
            nconf.get('schema').supporters, 
            { numId: supportInfo.numId },
            { $set : { lastInfo: moment().format(),  }}
        ),
        mongo.writeMany(
            nconf.get('schema').timeline,
            processed.timeline
        ),
        mongo.writeMany(
            nconf.get('schema').refreshes,
            processed.refreshes
        ),
        utils.JSONsave('/dev/shm', 'outPut', {
            ipaddr: ipaddr,
            supportInfo: supportInfo,
            refreshes: refreshes
        })
    ])
    .then(function(results) {
        if( results[0] && results[1] ) {
            return { "json": { "status": "OK" }};
        } else {
            debug("%j %j %j", results[0], results[1], results[2]);
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
    /* todo transform this check with the hashed one,
     * or with the normal number if the user permitted 
     * to get looked publicly */
    var profileId = _.parseInt(req.params.profileId);

    if(_.isNaN(profileId))
        throw new Error("Invalid user requested?");

    return mongo
        .read(nconf.get('schema').supporters, 
              {numId: profileId})
        .then(function(user) {
            /* todo limit to 100 or such ? */
            return mongo
              .read(nconf.get('schema').timeline, {});
        })
        .then(function(tle) {
            /* split the timeLineEvents in the refreshes */
            debug("%s userTimeLine return %d TLE", 
                req.randomUnicode, _.size(tle));
            return { 'json' : { 'unsordetyet': tle }};
        });
};

var userSimpleGraph = function(req) {
    var profileId = _.parseInt(req.params.profileId);

    if(_.isNaN(profileId))
        throw new Error("Invalid user requested?");

    return mongo
        .read('facebook1', {profileId: profileId})
        .reduce(function(memo, entry) {
            if(entry.location !== '/')
                return memo;

            var postInfo = utils.getPostInfo(entry);
            memo.push(_.extend(postInfo, {
                when: entry.when,
                order: entry.order
            }));
            return memo;
        }, [])
        .tap(function(results) {
            debug("%s After the reduction, are kept %d entries", 
                req.randomUnicode, _.size(results));
        })
        .then(function(results) {
            return {
                json: results
            };
        });
};

var getPersonal = function(req) {
    var profileId = _.parseInt(req.params.profileId);
    var customInfo;
    debug("%s getPersonal page", req.randomUnicode);
    /* this is the page polling from getSimpleGraph */
    return mongo
        .read('supporters', {profileId: profileId})
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
    userSimpleGraph: userSimpleGraph,
    exportNode: exportNode,
    writeContrib: writeContrib
};
