var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('snippet');
var nconf = require('nconf');

var mongo = require('./mongo');
var utils = require('./utils');
var error = require('./error');

function importSelector(body) {
    /* sanitize the request and shape in the proper selector */
    var since = _.get(req.body, 'since');
    var until = _.get(req.body, 'until');
    var parserName = _.get(req.body, 'parserName');
    var repeat = _.get(req.body, 'repeat');
    var requirements = _.get(req.body, 'requirements');
    var selret = {};

    selret = {
      writingTime : { 
          "$gt": new Date(since),
          "$lt": new Date(until)
      },
    }

};

function snippetStatus(req) {

    var selector = importSelector(req.body);

};

function snippetContent(req) {
    var selector = importSelector(req.body);

};
function snippetResult(req) {

};

module.exports = {
    snippetStatus: snippetStatus,
    snippetContent: snippetContent,
    snippetResult: snippetResult
};
