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
var slideLong = jadeCompiler('slidelong');
var slideShort = jadeCompiler('slideshort');
var realitymeterP = jadeCompiler('realitymeter');

var staticAccess = function(request, details) {

    var sourceIP = _.get(request.headers, "x-forwarded-for");
    var geoinfo = utils.getGeoIP(sourceIP);
    var accessInfo = {
        when: moment().format(),
        ip: sourceIP,
        geo: geoinfo.code,
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

var getPresentation = function(req) {

    var slideType = 'short';
    var slideGenerator = slideShort;
    if(_.get(req.params, 'name') === 'long') {
        slideType = 'long';
        slideGenerator = slideLong;
    }

    debug("%s getOverseer page kind %s",
        req.randomUnicode, slideType);

    return staticAccess(req, {page: "presentation", type: slideType})
        .then(function() {
            return { 'text': slideGenerator() };
        });
};

var getRealityMeter = function(req) {
    debug("%s getRealityMeter page", req.randomUnicode);
    /* this is a page polling from getAdminView */
    return staticAccess(req, {page: "realitymeter"})
        .then(function() { 
            return { 'text': realitymeterP({users: 20}) };
        });
};


module.exports = {
    getIndex: getIndex,
    getPersonal: getPersonal,
    getOverseer: getOverseer,
    getPresentation: getPresentation,
    getRealityMeter: getRealityMeter
};
