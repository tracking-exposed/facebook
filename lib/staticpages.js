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
  'NetherlandsElections': jadeCompiler('NetherlandsElections'),
  'talks-netzpolitischer054': jadeCompiler('talks/netzpolitischer054'),
  'talks-cyberresistance': jadeCompiler('talks/cyberresistance'),
  'talks-torinohacknight': jadeCompiler('talks/torinohacknight'),
  'talks-rightscon17': jadeCompiler('talks/rightscon17'),
  'talks-ijf17': jadeCompiler('talks/ijf17'),

  'background-thoughts': jadeCompiler('background-thoughts'),
  'privacy-statement': jadeCompiler('privacyStatement'),
  'beta': jadeCompiler('beta'),
  'backstory': jadeCompiler('backstory'),
  'revision': jadeCompiler('revision'),
  'alarms': jadeCompiler('alarms'),
  'about': jadeCompiler('team'),
  '404': jadeCompiler('404'),
  '/': jadeCompiler('index'),

  'realitymeter': jadeCompiler('realitymeter/app'),

  'realitycheck-data': jadeCompiler('realitycheck/data'),
  'realitycheck-recent': jadeCompiler('realitycheck/data'),
  'realitycheck-csv': jadeCompiler('realitycheck/csv'),
  'realitycheck-overlook': jadeCompiler('realitycheck/overlook')
};

var getPage = function(req) {

    var pageName = _.get(req.params, 'page', '/');

    if(_.isUndefined(_.get(pageMap, pageName))) {
        debug("%s getPage '%s': not found", req.randomUnicode, pageName);
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


module.exports = {
    getImpact: getImpact,
    getPage: getPage
};
