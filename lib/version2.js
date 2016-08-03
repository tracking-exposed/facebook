var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('api-2');
var geoip = require('geoip-native');
var os = require('os');
var disk = Promise.promisifyAll(require('diskusage'));
var jade = require('jade');
 
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
        ]).then(function(numbers) {
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
    var supportInfo = _.merge(_.get(req.body, 'from'), {
        counter: 0,
        when: moment().format()
    });
    supportInfo.id = _.parseInt(supportInfo.id);

    if(_.isNaN(supportInfo.id))
        throw new Error("Invalid user received?");

    debug("%s The feed importing starts", req.randomUnicode);

    var refreshes = _.get(req.body, ['timeline']);
    // var debugStats = _.get(req.body, ['locations']);

    if(!_.size(refreshes)) {
        debug("%s No feed timeline extractions now", req.randomUnicode);
    }

    debug("User %d supply with %d refreshes", 
          supportInfo.id, _.size(refreshes));

    return Promise
        .all([ mongo.writeMany('refresh2', refreshes),
               mongo.writeOne('supporters', supportInfo),
               utils.JSONsave('/dev/shm', 'postFeed', req.body),
               utils.JSONsave('/dev/shm', 'outPut', {
                  refreshes: refreshes,
                  ipaddr: ipaddr,
                  supportInfo: supportInfo
               })
        ])
        .then(function(results) {
            if( results[0] && results[1] ) {
                return { 'text': 'OK' };
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
    var profileId = _.parseInt(req.params.profileId);

    if(_.isNaN(profileId))
        throw new Error("Invalid user requested?");

    return mongo
        .read('refresh2', {})
        .then(function(coll) {
            debug("%s userTimeLine return %d refreshes", 
                req.randomUnicode, _.size(coll));
            return {
                json: colls
            };
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
