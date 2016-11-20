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

var impactP = jadeCompiler('impact');
var activitiesP = jadeCompiler('realitycheck/activities');
var timelinesP = jadeCompiler('realitycheck/timelines');
var realitymeterP = jadeCompiler('realitymeter');

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

    if(_.isUndefined(_.get(details, 'page')))
        debug("%s Developer, check it out, %j lack of 'page' key",
            request.randomUnicode, details);

    debug("%s Logging %j", request.randomUnicode, details);
    return Promise.resolve(
        /* stress test, because maybe is too much and is better 
         * keep in memory and flush once a while */
        mongo.writeOne(nconf.get('schema').accesses, accessInfo)
    );
};


/* getRandomUser might stop to became a promise (for example: having a 
 * cached list of userId),
 * shapePersonal can comeback 2 be getPersonal, random can be managed inside
 */
var getRandom = function(req) {
    var templ = (req.params.page == 'timelines') ? timelinesP : activitiesP;

    return mongo
      .getRandomUser(nconf.get('schema').supporters)
      .then(function(userId) {
          debug("%s getRandom has pick user %d", req.randomUnicode, userId);
          return getUserInfo(req, userId);
      })
      .then(function(userInfo) {
          return { 'text': templ(userInfo) };
      });
};

var getPersonal = function(req) {
    var userId = _.parseInt(req.params.userId);
    var templ = (req.params.page == 'timelines') ? timelinesP : activitiesP;

    debug("%s getPersonal page for %d", req.randomUnicode, userId);
    return getUserInfo(req, userId)
      .then(function(userInfo) {
          return { 'text': templ(userInfo) };
      });
};

var getUserInfo = function(req, userId) {

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
                'lastInfo': null,
                'distance': null,
            };
        } 
        userInfo = {
            'userId': user.userId,
            'displayName': user.userId, // not currently used
            'timelines': timelinfo,
            'lastInfo': user.lastInfo,
            'distance': moment.duration(moment() - user.lastInfo).humanize()
        };
        return staticAccess(req, {page: "realitycheck", userId: userId})
            .return(userInfo);
    });
};

var getImpact = function(req) {
    debug("%s getImpact page", req.randomUnicode);
    /* this is a page polling from publicStats */
    return Promise.all([
        staticAccess(req, {page: "impact"}),
        mongo.getNodeStats(nconf.get('schema'))
    ])
    .then(function(results) {
        var stats = utils.formatNodeStats(_.last(results));
        return { 'text': impactP(stats) };
    });
};

var pageMap = {
  'talks': jadeCompiler('talks/landing'),
  'talks-netzpolitischer054': jadeCompiler('talks/netzpolitischer054'),
  'background-thoughts': jadeCompiler('background-thoughts'),
  'beta': jadeCompiler('beta'),
  '404': jadeCompiler('404'),
  '/': jadeCompiler('index')
};

var getPage = function(req) {

    var pageName = _.get(req.params, 'page', '/');

    if(_.isUndefined(_.get(pageMap, pageName))) {
        debug("%s getPage on %s: not found", req.randomUnicode, pageName);
        pageName = '404';
    } else {
        debug("%s getPage of %s", req.randomUnicode, pageName);
    }

    return staticAccess(req, {page: "page", name: pageName })
        .then(function() {
            /* the variable 'members' is given to every template, I 
             * can setup a list of vars above, or define in the future
             * that every page has nearly everything in memory of the sys */
            return { 
                'text': pageMap[pageName]({
                    'members': _.shuffle(nconf.get('members'))
                })
            };
        });
};
  /*
   * if(!_.isUndefined(_.get(templateMap, geoinfo.code))) {
   *     debug("GeoIP of %s return %s", sourceIP, geoinfo.name);
   *     index = _.get(templateMap, geoinfo.code)();
   */

var getRealityMeter = function(req) {
    var postId = _.parseInt(req.params.postId);
    debug("%s getRealityMeter page (postId %d)", req.randomUnicode, postId);
    if(_.isNaN(postId)) postId = 0;
    return staticAccess(req, {page: "realitymeter"})
        .then(function() {
            return Promise.all([
                mongo.getNodeStats(nconf.get('schema')),
                mongo.getPostRelations( nconf.get('schema').timeline, {})
            ]);
        })
        .then(function(rawinfo) {
            return {
              examples: utils.topPostsFixer(_.last(rawinfo)),
              stats: utils.formatNodeStats(_.first(rawinfo))
            };
        })
        .then(function(infos) {
            return { 'text': realitymeterP(
              {
                timelines: infos.stats.timelines,
                posts: infos.stats.posts,
                users: infos.stats.users,
                postId: postId,
                examples: infos.examples
              })
            };
        });
};


module.exports = {
    getPersonal: getPersonal,
    getRandom: getRandom,
    getImpact: getImpact,
    getPage: getPage,
    getRealityMeter: getRealityMeter
};
