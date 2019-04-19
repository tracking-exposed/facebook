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

var pageMap = {
  'initiatives': pugCompiler('talks/landing'),
  'NetherlandsElections': pugCompiler('NetherlandsElections'),
  'talks-netzpolitischer054': pugCompiler('talks/netzpolitischer054'),
  'talks-cyberresistance': pugCompiler('talks/cyberresistance'),
  'talks-torinohacknight': pugCompiler('talks/torinohacknight'),
  'talks-rightscon17': pugCompiler('talks/rightscon17'),
  'talks-ijf17': pugCompiler('talks/ijf17'),

  'privacy-statement': pugCompiler('privacyStatement'),
  'beta': pugCompiler('beta'),
  'realitycheck': pugCompiler('realitycheck'),
  'backstory': pugCompiler('backstory'),
  'revision': pugCompiler('revision/revision'),
  'bydate': pugCompiler('revision/bydate'),
  'verify': pugCompiler('verify'),
  'fbtrexdebug': pugCompiler('fbtrexdebug'),
  'about': pugCompiler('team'),
  '404': pugCompiler('404'),
  '/': pugCompiler('index'),
  'new': pugCompiler('new'),
  'unset': pugCompiler('unset'),

  'impact': pugCompiler('statistics/index'),
  'parsers': pugCompiler('statistics/parsers'),
  'aggregated': pugCompiler('statistics/aggregated'),

  'project': pugCompiler('project/index'),
  'project/glossary': pugCompiler('project/glossary'),
  'project/summaries': pugCompiler('project/summaries'),
  'project/problem': pugCompiler('project/problem'),
  'project/solution': pugCompiler('project/solution'),
  'project/details': pugCompiler('project/details'),

  'qualitativeLanding': pugCompiler('research/landing'),
  'qualitativeDaylist': pugCompiler('research/daylist'),

  'data': pugCompiler('personal/summary'),
  'summary': pugCompiler('personal/summary'),
  'specs': pugCompiler('personal/specs'),
  'gdpr': pugCompiler('personal/gdpr'),
  'stats': pugCompiler('personal/stats'),
};

var getPage = function(req) {

    var pageName = _.get(req.params, 'page', '/');

    if(_.isUndefined(_.get(pageMap, pageName))) {
        debug("[%s] default to getPage but not found", req.originalUrl);
        pageName = '404';
    } else {
        debug("%s trigger getPage of %s", req.originalUrl, pageName);
    }

    return accesslog(req, {page: pageName})
        .then(function() {
            return { 
                'text': pageMap[pageName]()
            };
        });
};


module.exports = {
    getPage: getPage
};
