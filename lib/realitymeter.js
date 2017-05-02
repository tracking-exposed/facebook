var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:realitymeter');
var os = require('os');
var nconf = require('nconf');
 
var mongo = require('./mongo');
var utils = require('./utils');

function getTopPosts(req) {
    var minUpdates = 15;
    var maxPosts = 20;
    debug("%s getTopPosts (max %d, min views %d)", req.randomUnicode, maxPosts, minUpdates);

    return mongo
        .readLimit(nconf.get('schema').reality, {"updates": { "$gt": minUpdates }}, {updates: -1}, maxPosts, 0)
        .then(function(xxx) {
            return { 'json': xxx };
        });
};

function postReality(req) {
    /* because is a String in <reality>, can you believe it ? */
    var postId = _.parseInt(req.params.postId) + "";

    debug("%s PostLife post %d", req.randomUnicode, postId);
    return mongo
        .read(nconf.get('schema').reality, {postId: postId})
        .then(_.first)
        .then(function(xxx) {
            return { 'json': xxx };
        })
        .catch(function(error) {
            debug("%s PostLife error: %s", req.randomUnicode, error);
            return { 'json': { 'error': error }};
        });
};

module.exports = {
    postReality: postReality,
    getTopPosts: getTopPosts
};
