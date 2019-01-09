var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:staticpages');
var pug = require('pug');
var nconf = require('nconf');

var mongo = require('./mongo');
var utils = require('./utils');
var opendata = require('./opendata');
var accesslog = require('./accesslog');

var pugCompiler = function(filePrefix) {
    return pug.compileFile(
        __dirname + '/../sections/' + filePrefix + '.pug', {
            pretty: true,
            debug: false
        }
    );
};

var impactP = pugCompiler('impact');

var getImpact = function(req) {
    debug("%s getImpact page", req.randomUnicode);
    /* this is a page polling from publicStats */

    return Promise
        .all([
            accesslog(req, {page: "impact"}),
            opendata.getNodeNumbers()
         ])
        .then(function(results) {
            return { 'text': impactP(_.last(results)) };
        });
    };

var pageMap = {
  'initiatives': pugCompiler('talks/landing'),
  'NetherlandsElections': pugCompiler('NetherlandsElections'),
  'talks-netzpolitischer054': pugCompiler('talks/netzpolitischer054'),
  'talks-cyberresistance': pugCompiler('talks/cyberresistance'),
  'talks-torinohacknight': pugCompiler('talks/torinohacknight'),
  'talks-rightscon17': pugCompiler('talks/rightscon17'),
  'talks-ijf17': pugCompiler('talks/ijf17'),

  'background-thoughts': pugCompiler('background-thoughts'),
  'privacy-statement': pugCompiler('privacyStatement'),
  'beta': pugCompiler('beta'),
  'realitycheck': pugCompiler('realitycheck'),
  'backstory': pugCompiler('backstory'),
  'revision': pugCompiler('revision'),
  'alarms': pugCompiler('alarms'),
  'about': pugCompiler('team'),
  '404': pugCompiler('404'),
  '/': pugCompiler('index'),
  'new': pugCompiler('new'),
  'unset': pugCompiler('unset'),

  'project': pugCompiler('project/index'),
  'project/glossary': pugCompiler('project/glossary'),
  'project/summaries': pugCompiler('project/summaries'),
  'project/problem': pugCompiler('project/problem'),
  'project/solution': pugCompiler('project/solution'),
  'project/details': pugCompiler('project/details'),

  'qualitativeLanding': pugCompiler('research/landing'),
  'qualitativeDaylist': pugCompiler('research/daylist'),

  'personal': pugCompiler('personal/landing'),
};

var getPage = function(req) {

    var pageName = _.get(req.params, 'page', '/');

    if(_.isUndefined(_.get(pageMap, pageName))) {
        debug("%s getPage '%s': not found", req.randomUnicode, pageName);
        pageName = '404';
    } else {
        debug("%s getPage of %s", req.randomUnicode, pageName);
    }

    return accesslog(req, _.set({}, 'page', pageName))
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
