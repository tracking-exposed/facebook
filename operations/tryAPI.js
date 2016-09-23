#!/usr/bin/env nodejs
var _ = require('lodash');
var Promise = require('bluebird');
var util = require('util');
var fs = Promise.promisifyAll(require('fs'));
var request = Promise.promisifyAll(require('request'));
var debug = require('debug')('tryAPI');
var nconf = require('nconf')

nconf.argv().env();

if ( _.isUndefined(nconf.get('DEBUG')) || 
     _.isUndefined(nconf.get('url')) ) {
    console.log("Set 'DEBUG' env variable and 'url' ");
    return -1;
}

var version = 2;
var url = nconf.get('url');
var postId = nconf.get('postId');
var userId = nconf.get('userId');
var pickedO = null;

/* this is the utilty for all the connection */
var apiR = function(base, api, print) {
    var URL = base + api;
    debug("Connecting to %s", URL);
    return request
        .getAsync({url: URL})
        .then(function(response) {
            return JSON.parse(response.body);
        })
        .tap(function(infos) {
            debug("Retrieved %s", URL);
            if(!_.isUndefined(print) && print === true)
                console.log(JSON.stringify(infos, undefined, 2));
        })
        .catch(function(error) {
            debug("!Error with %s: %s", URL, error);
        });
};

/* these three are the actual testing block */
var testByUser = function(alli) {
    var anUser = getInfo(alli, 'userId');
    return Promise.all([
        apiR(url, '/user/'+version+'/timeline/'+ anUser+'/0/1/1'),
        apiR(url,
            '/user/'+version+'/daily/'+ anUser+'/column',
            false),
        apiR(url,
            '/user/'+version+'/analysis/presence/'+ anUser+'/column',
            false),
        apiR(url,
            '/user/'+version+'/analysis/distortion/'+ anUser+'/column',
            false)
    ]);
};

var testByPost= function(alli) {
    var aPost = getInfo(alli, 'postId');
    return Promise.all([
        apiR(url, '/post/top/'+version+'/'+ aPost),
        apiR(url, '/post/reality/'+version+'/'+ aPost)
    ]);
};

var testByUserPost = function(alli) {
    var aPost = getInfo(alli, 'postId');
    var anUser = getInfo(alli, 'userId');
    return apiR(url, '/post/perceived/'+version+'/'+aPost+'/'+anUser);
};

var testNode = function(alli) {
    return apiR(url, '/node/activity/'+version+'/json', true);
};

var getInfo = function(alli, kind) {

    if(!_.isNull(pickedO))
        return _.get(pickedO, kind);

    var cleaned = _.reject(alli.exported[1], {postId: null});

    if(!_.isUndefined(postId)) {
        pickedO = _.find(cleaned, {postId: _.parseInt(postId) });
    } else if(!_.isUndefined(userId)) {
        pickedO = _.find(cleaned, {userId: _.parseInt(userId) });
    } else {
        pickedO = _.sample(cleaned);
    }
    if(_.isUndefined(pickedO))
        pickedO = _.sample(cleaned);

    return _.get(pickedO, kind);
};


/* This is the beginning of everything */
return apiR(url, '/node/info/' + version)
.then(function(basicInfo) {
    return apiR(url, '/node/export/' + version + '/0')
        .tap(function(infos) {
            return Promise.all([
                testByUser(infos),
                testByPost(infos),
                testByUserPost(infos),
                testNode(infos) 
            ])
        });
})
.tap(function(x) {
    console.log("You reach the end!");
});
