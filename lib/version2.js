var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('api-2');
var geoip = require('geoip-native');
var os = require('os');
var disk = Promise.promisifyAll(require('diskusage'));
 
var mongo = require('./mongo');
var token = require('./token');
var utils = require('./utils');

var HTTPBadRequest = {
    httpcode: 400 // Bad Request, the justification to everything
};

var adminStats = function(req) {
    /* TODO auth, TODO more info */
    debug("this is adminStats");
    return publicStats(req)
        .then(function(retVal) {
            retVal.json.loadavg = os.loadavg();
            return retVal;
        });
};

var publicStats = function(req) {
    debug("this is publicStats, play with some cache?");
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

var getToken = function(req) {
    /* the logic here is: you can get back your token once,
     * if no token for you IP is present, you get one
     * a token last for 30 seconds */
    var kind = _.get(req.params, 'reason');
    var profileId = _.parseInt(_.get(req.params, 'profileId'));
    var ipaddr = _.get(req.headers, "x-forwarded-for") || "127.0.0.1";

    if(_.isUndefined(kind) || _.isNaN(profileId))
        return NotFoundHTTPError;

    if(!(token.canIgiveNewToken(ipaddr, kind, profileId)))
        return NotFoundHTTPError;

    var newToken = token.issueToken(ipaddr, kind, profileId);

    debug("New Token issued: %j", newToken);
    return {
        json: {    
            ttl: token.tokenLifetime,
            token: newToken.tokenId
        }
    };
};

var postFeed = function(req) {

    var keptf = ['location', 'when', 'order', 'content'];
    var tokenId = _.get(req.body, 'token');
    var ipaddr = _.get(req.headers, "x-forwarded-for") || "127.0.0.1";

    var supportInfo = _.merge(_.get(req.body, 'from'), {
        counter: 0,
        when: moment().format()
    });
    supportInfo.id = _.parseInt(supportInfo.id);

    /* when a token is invalid, the answer do not change, just
     * I log the error and not the content */
    if(!(token.isValidToken(ipaddr, 'feed', supportInfo.id, tokenId))) {
        debug("Note: silent failure here");
        return {
            'text': 'OK'
        };
    }

    token.invalidateToken(ipaddr, supportInfo.id, 'feed', tokenId);

    var timelinfo = _.reduce(req.body.content, function(memo, tle) {
        if(!_.isUndefined(_.get(tle, 'why'))) {
            debug("Ignoring entry %j", tle);
            return memo;
        }

        var rtVal = _.pick(tle, keptf);
        rtVal.content = _.map(rtVal.content, utils.tLineContentClean);
        rtVal.profileId = supportInfo.id;
        supportInfo.counter += 1;
        memo.push(rtVal);
        return memo;
    }, []);

    return Promise
        .all([ mongo.writeOne('supporters', supportInfo),
               mongo.writeMany('facebook1', timelinfo) ])
        .then(function(results) {
            if( results[0] && results[1]) {
                return {
                    'text': 'OK'
                };
            } else {
                reportError.reportError({
                    'when': moment(),
                    'function': 'postFeed',
                    'version': 1,
                    'info': results,
                });
                throw new Error("Unknown");
            }
        });
};

var userPublicPage = function(req) {
    debug("TODO userPublicPage");
};

var userPrivateView = function(req) {
    debug("TODO userPrivateView");
};

var exportNode = function(req) {
    var queryS = req.params.selector === 'all' ? {} : req.params.selector;
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

var adminTokenCheck = function(req) {
  return {
      json: { 
          tokens: token.tokens,
          failures: token.tokenFailures
      }
  };
};

module.exports = {
    adminStats: adminStats,
    adminTokenCheck: adminTokenCheck,
    publicStats: publicStats,
    postFeed: postFeed,
    // getIndex: getIndex, // Is the same of version 1
    getToken: getToken,
    userPublicPage: userPublicPage,
    userPrivateView: userPrivateView,
    exportNode: exportNode,
    writeContrib: writeContrib
};
