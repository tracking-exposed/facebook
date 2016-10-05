var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('staticpages');
var jade = require('jade');

var mongo = require('./mongo');
var error = require('./error');
var utils = require('./utils');

var nconf = require('nconf');

var jadeCompiler = function(filePrefix) {
    return jade.compileFile(
        __dirname + '/../sections/' + filePrefix + '.jade', {
            pretty: true,
            debug: false
        }
    );
};

var index = jadeCompiler('generic');
var impactP = jadeCompiler('impact');
var personalP = jadeCompiler('personal');
var overseerP = jadeCompiler('overseer');
var realitymeterP = jadeCompiler('realitymeter');

var slideLong = jadeCompiler('slidelong');
var slideShort = jadeCompiler('slideshort');
var background = jadeCompiler('background');

var staticAccess = function(request, details) {

    var sourceIP = _.get(request.headers, "x-forwarded-for");
    var geoinfo = utils.getGeoIP(sourceIP);
    var accessInfo = {
        when: moment().format(),
        ip: sourceIP,
        ccode: geoinfo.code,
        refer: request.headers.referer,
        details: details
    };

    debug("Logging access of %j", details);
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


/* The reason why I split the call, is getRandomUser is a promise,
 * therefore has to be .then in sequence. if getRandomUser stop to
 * became a promise (for example: having a cached list of userId),
 * shapePersonal can became getPersonal and 'random' can be managed inside
 * */
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
    return shapePersonal(reqm, userId);
};
var shapePersonal = function(req, userId) {

    return Promise.all([
        mongo.read(nconf.get('schema').supporters, {userId: userId}),
        mongo.count(nconf.get('schema').timeline, {userId: userId})
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
        return { 'text': personalP(userInfo) };
    });
};

var getOverseer = function(req) {
    debug("%s getOverseer page", req.randomUnicode);
    /* this is a page polling from getAdminView */
    return staticAccess(req, {page: "overseer"})
        .then(function() {
            return { 'text': overseerP() };
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
    debug("%s getRealityMeter page", req.randomUnicode);
    /* this page poll from public/post/ and ignore the /:postId */
    return staticAccess(req, {page: "realitymeter"})
        .then(function() {
            return mongo.count(nconf.get('schema').supporters);
        })
        .then(function(usersCount) { 
            return { 'text': realitymeterP({users: usersCount}) };
        });
};


module.exports = {
    getIndex: getIndex,
    getPersonal: getPersonal,
    getRandom: getRandom,
    getOverseer: getOverseer,
    getImpact: getImpact,
    getPage: getPage,
    getRealityMeter: getRealityMeter
};
