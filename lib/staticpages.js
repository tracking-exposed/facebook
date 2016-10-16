var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('staticpages');
var jade = require('jade');
var nconf = require('nconf');

var mongo = require('./mongo');
var error = require('./error');
var utils = require('./utils');

var jadeCompiler = function(filePrefix) {
    return jade.compileFile(
        __dirname + '/../sections/' + filePrefix + '.jade', {
            pretty: true,
            debug: false
        }
    );
};

var index = jadeCompiler('homepage');
var impactP = jadeCompiler('impact');
var personalP = jadeCompiler('realitycheck/activities');
var timelinesP = jadeCompiler('realitycheck/timelines');
var realitymeterP = jadeCompiler('realitymeter');

var slideLong = jadeCompiler('slidelong');
var slideShort = jadeCompiler('slideshort');
var background = jadeCompiler('background');

var staticAccess = function(request, details) {
    var sourceIP = _.get(request.headers, "x-forwarded-for");
    var geoinfo = utils.getGeoIP(sourceIP);
    var accessInfo = {
        when: moment().toISOString(),
        ip: sourceIP,
        ccode: geoinfo.code,
        referer: request.headers.referer,
        details: details
    };

    if(!_.isUndefined(_.get(details, 'page')))
        debug("%s Developer, check it out, %j lack of 'page' key",
            request.randomUnicode, details);

    debug("%s Logging %j", request.randomUnicode, details);
    return Promise.resolve(
        /* stress test, because maybe is too much and is better 
         * keep in memory and flush once a while */
        mongo.writeOne(nconf.get('schema').accesses, accessInfo)
    );
};

var getIndex = function (req) {
  /*
   * if(!_.isUndefined(_.get(templateMap, geoinfo.code))) {
   *     debug("GeoIP of %s return %s", sourceIP, geoinfo.name);
   *     index = _.get(templateMap, geoinfo.code)();
   */
    return staticAccess(req, {page: "index"})
        .then(function() {
            return { 'text': index() };
        });
};


/* getRandomUser might stop to became a promise (for example: having a 
 * cached list of userId),
 * shapePersonal can became getPersonal and 'random' can be managed inside
 */
var getRandom = function(req) {
    return mongo
      .getRandomUser(nconf.get('schema').supporters)
      .then(function(userId) {
          debug("%s getRandom has pick user %d",
              req.randomUnicode, userId);
          return shapePersonal(req, userId);
      });
};
var getPersonal = function(req) {
    var userId = _.parseInt(req.params.userId);
    /* this is the page polling from getSimpleGraph */

    debug("%s getPersonal page for %d", req.randomUnicode, userId);
    return shapePersonal(req, userId);
};
var shapePersonal = function(req, userId) {

    return Promise.all([
        mongo.read(nconf.get('schema').supporters, {userId: userId}),
        mongo.countByMatch(nconf.get('schema').timeline, {userId: userId})
    ])
    .then(function(infos) {
        user = _.head(_.head(infos));
        timelinfo = _.head(_.tail(infos));

        if(_.isUndefined(user) || _.isUndefined(user.userId)) {
            debug("user %d not found in the supporters list", userId);
            return {
                'userId': 0,
                'displayName': '(Not found)',
                'timelines': 0,
                'lastInfo': null
            };
        } 
        userInfo = {
            'userId': user.userId,
            'displayName': user.userId, // not currently used
            'timelines': timelinfo,
            'lastInfo': user.lastInfo
        };
        return staticAccess(req, {page: "realitycheck", userId: userId})
            .return(userInfo);
    })
    .then(function(userInfo) {
        return { 'text': timelinesP(userInfo) };
    });
};

var getImpact = function(req) {
    debug("%s getImpact page", req.randomUnicode);
    /* this is a page polling from publicStats */
    return staticAccess(req, {page: "impact"})
        .then(function() {
            return { 'text': impactP() };
        });
};

var getPage = function(req) {
    var pageMap = {
        'short-presentation': slideShort,
        'long-presentation': slideLong,
        'background-thoughts': background
    };
    var pageName = _.get(req.params, 'name');
 
    if(_.isUndefined(pageName))
        throw new Error("Invalid page name");
    if(_.isUndefined(_.get(pageMap, pageName)))
        throw new Error("Invalid page name");

    var slideGenerator = pageMap[pageName];
    debug("%s getPage of %s", req.randomUnicode, pageName);
    return staticAccess(req, {page: "page", name: pageName })
        .then(function() {
            return { 'text': slideGenerator() };
        });
};


var getRealityMeter = function(req) {
    var postId = _.parseInt(req.params.postId);
    debug("%s getRealityMeter page (postId %d)", req.randomUnicode, postId);
    if(_.isNaN(postId)) postId = 0;
    return staticAccess(req, {page: "realitymeter"})
        .then(function() {
            return Promise.all([
                mongo.countByMatch(nconf.get('schema').timeline, {}),
                mongo.countByMatch(nconf.get('schema').supporters, {}),
                mongo.getPostRelations( nconf.get('schema').timeline, {})
            ]);
        })
        .then(function(infos) {
            var examples = utils.topPostsFixer(_.last(infos));
            debugger;
            return { 'text': realitymeterP({
                posts: _.first(infos),
                users: _.nth(infos, 1),
                postId: postId,
                examples: examples
            }) };
        });
};


module.exports = {
    getIndex: getIndex,
    getPersonal: getPersonal,
    getRandom: getRandom,
    getImpact: getImpact,
    getPage: getPage,
    getRealityMeter: getRealityMeter
};
