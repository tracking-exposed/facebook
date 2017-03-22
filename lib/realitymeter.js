var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:realitymeter');
var os = require('os');
var nconf = require('nconf');
 
var mongo = require('./mongo');
var utils = require('./utils');


function getTopPosts(req) {

    return mongo
        .readLimit(nconf.get('schema').reality, {"updates": { "$gt": 15 }}, {updates: -1}, 20, 0)
        .then(function(xxx) {
            return { 'json': xxx };
        });
};
function postReality(req) {
    /* because is a String in <reality>, can you believe it ? */
    var postId = _.parseInt(req.params.postId) + "";

    debug("%s PostLife post %d", req.randomUnicode, postId);
    debug
    return mongo.read(nconf.get('schema').reality, {postId: postId})
        .then(_.first)
        .then(function(xxx) {
            return { 'json': xxx };
        });
};

module.exports = {
    postReality: postReality,
    getTopPosts: getTopPosts,
};
