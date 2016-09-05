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

var getPersonal = function(req) {
    var profileId = _.parseInt(req.params.profileId);
    var customInfo;
    debug("%s getPersonal page for %d", req.randomUnicode, profileId);
    /* this is the page polling from getSimpleGraph */
    return staticAccess(req, {page: "realitycheck", userId: profileId})
        .then(function() {
            return mongo
                .read(nconf.get('schema').supporters, 
                      {userId: profileId});
        })
        .then(function(user) {
            user = _.first(user);
            customInfo = {
                'profileId': user.userId,
                'timelines': user.numberOftimeLine,
                'lastInfo': user.lastInfo
            };
            return { 'text': personalP(customInfo) };
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
    getOverseer: getOverseer,
    getPage: getPage,
    getRealityMeter: getRealityMeter
};
