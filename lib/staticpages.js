var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:staticpages');
var jade = require('jade');
var nconf = require('nconf');

var mongo = require('./mongo');
var utils = require('./utils');
var opendata = require('./opendata');

var jadeCompiler = function(filePrefix) {
    return jade.compileFile(
        __dirname + '/../sections/' + filePrefix + '.jade', {
            pretty: true,
            debug: false
        }
    );
};

var impactP = jadeCompiler('impact');
var realitymeterP = jadeCompiler('realitymeter');
// pre-hackathon changes, you know ?
// var realitycheckP = jadeCompiler('realitycheck/landing');

var staticAccess = function(request, details) {
    var sourceIP = _.get(request.headers, "x-forwarded-for");
    var geoinfo = utils.getGeoIP(sourceIP);
    var accessInfo = {
        when: new Date(moment().toISOString()),
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

/*
var getRealityCheck = function(req) {

    var userId = _.parseInt(req.params.userId);

    return Promise.all([
        mongo.read(nconf.get('schema').supporters, {userId: userId}),
        mongo.countByMatch(nconf.get('schema').timelines, {userId: userId})
    ])
    .then(function(infos) {
        user = _.head(_.head(infos));
        timelinfo = _.head(_.tail(infos));

        if(!user || !user.userId) {
            debug("user %d not found in the supporters list", userId);
            userInfo = {
                'userId': 0,
                'timelines': 0,
                'lastActivity': null,
                'distance': null,
            };
        } else {
            userInfo = {
                'userId': user.userId,
                'timelines': timelinfo,
                'lastActivity': user.lastActivity,
                'distance': moment.duration(moment() - user.lastActivity).humanize()
            };
        }

        debug("Rending realityCheck with %d timelines, lastActivity %s",
            userInfo.timelines, userInfo.lastActivity);

        return staticAccess(req, {page: "realitycheck"})
            .return(userInfo);
    })
    .then(function() {
        return { 'text': realitycheckP(userInfo) };
    });
};
*/

var getImpact = function(req) {
    debug("%s getImpact page", req.randomUnicode);
    /* this is a page polling from publicStats */

    return Promise
        .all([
            staticAccess(req, {page: "impact"}),
            opendata.getNodeNumbers()
         ])
        .then(function(results) {
            return { 'text': impactP(_.last(results)) };
        });
    };

var pageMap = {
  'initiatives': jadeCompiler('talks/landing'),
  'talks-netzpolitischer054': jadeCompiler('talks/netzpolitischer054'),
  'talks-cyberresistance': jadeCompiler('talks/cyberresistance'),
  'talks-torinohacknight': jadeCompiler('talks/torinohacknight'),
  'background-thoughts': jadeCompiler('background-thoughts'),
  'beta': jadeCompiler('beta'),
  'privacy-statement': jadeCompiler('privacyStatement'),
  'backstory': jadeCompiler('backstory'),
  'revision': jadeCompiler('revision'),
  'alarms': jadeCompiler('alarms'),
  'about': jadeCompiler('team'),
  '404': jadeCompiler('404'),
  '/': jadeCompiler('index'),
  'NetherlandsElections': jadeCompiler('NetherlandsElections'),

  'realitycheck-data': jadeCompiler('realitycheck/data'),
  'realitycheck-profile': jadeCompiler('realitycheck/profile'),
  'realitycheck-recent': jadeCompiler('realitycheck/recent'),
  'realitycheck-overlook': jadeCompiler('realitycheck/overlook')
};

var getPage = function(req) {

    var pageName = _.get(req.params, 'page', '/');

    if(_.isUndefined(_.get(pageMap, pageName))) {
        debug("%s getPage on %s: not found", req.randomUnicode, pageName);
        pageName = '404';
    } else {
        debug("%s getPage of %s", req.randomUnicode, pageName);
    }

    return staticAccess(req, _.set({}, 'page', pageName))
        .then(function() {
            return { 
                'text': pageMap[pageName]()
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
    getImpact: getImpact,
    getPage: getPage,
    // getRealityCheck: getRealityCheck,
    getRealityMeter: getRealityMeter
};
