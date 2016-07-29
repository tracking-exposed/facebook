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
var error = require('./error');

var HTTPBadRequest = {
    httpcode: 400 // Bad Request, the justification to everything
};

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

    // debug("New Token issued: %j", newToken);
    return {
        json: {    
            ttl: token.tokenLifetime,
            token: newToken.tokenId
        }
    };
};

var postFeed = function(req) {

    /* just for development */
    utils.JSONsave('/dev/shm', 'postFeed', req.body);

    var tokenId = _.parseInt(_.get(req.body, 'token'));
    var ipaddr = _.get(req.headers, "x-forwarded-for") || "127.0.0.1";

    var supportInfo = _.merge(_.get(req.body, 'from'), {
        counter: 0,
        when: moment().format()
    });
    supportInfo.id = _.parseInt(supportInfo.id);

    /* when a token is invalid, the answer do not change, just
     * I log the error and not the content */
    if(!(token.isValidToken(ipaddr, 'feed', supportInfo.id, tokenId))) {
        debug("%s Note: silent failure here %s", 
              req.randomUnicode, token.pickLastError());
        return { 'text': 'OK' };
    }

    token.invalidateToken(ipaddr, supportInfo.id, 'feed', tokenId);

    debug("%s The feed parsing starts", req.randomUnicode);
    var orphans = _.takeWhile(req.body.content, {why: 'location_switch'});

    /* if has orphans, get last hash and link it */
    if(_.size(orphans)) {
        debug("%s we are going to find a family for these: %j", 
            req.randomUnicode, orphans);
    }
    /* and this family is the initalized of the reduce below */
    var postTransform = req.body.content.reduce(utils.analyzePosts, {
        homePageColl: [],
        existingPosts: [],
        last: {length:0, profileId:supportInfo.id, posts:[] }
    });
    var refreshes = _.pick(postTransform, ['homePageColl']);
    var existingPosts = _.pick(postTransform, ['existingPosts']);

    if(!_.size(refreshes)) {
        debug("%s No feed timeline extractions now", req.randomUnicode);
    }

    if(!_.size(existingPosts)) {
        debug("%s lack of existing Posts is a bug", req.randomUnicode);
    }

    var rawinfo = req.body.content.reduce(utils.keepRawInfo, []);

    utils.JSONsave('/dev/shm', 'outPut', {
        raw: rawinfo,
        refreshes: refreshes,
        existingPosts: existingPosts,
        orphans: orphans,
        supportInfo: supportInfo
    });

    debug("User %d supply with %d refreshes, %d posts %d raw", 
          supportInfo.id, _.size(refreshes),
          _.size(existingPosts), _.size(rawinfo) );

    return Promise
        .all([ mongo.writeMany('refresh2', refreshes),
               // mongo.writeOnlyNew('uniqueposts2', existingPosts),
               mongo.writeOne('supporters', supportInfo),
               mongo.writeMany('facebook1', rawinfo) 
        ])
        .then(function(results) {
            if( results[0] && results[1] && results[2] ) {
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

var userPublicPage = function(req) {
    debug("TODO userPublicPage");
};

var userPrivateView = function(req) {
    // at the moment .secret contain .profileId
    return mongo
        .read('facebook1', {profileId: 100005961541729});
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
