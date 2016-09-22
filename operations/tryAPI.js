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
            if(!_.isUndefined(print))
                console.log(JSON.stringify(infos, undefined, 2));
        })
        .catch(function(error) {
            debug("!Error with %s: %s", URL, error);
        });
};

/* these three are the actual testing block */
var testByUser = function(alli) {
    var anUser = _.sample(alli.exported[0]).userId;
    return Promise.all([
        apiR(url, '/user/'+version+'/timeline/'+ anUser+'/0/1/1'),
        apiR(url, '/user/'+version+'/daily/'+ anUser+'/json'),
        apiR(url, '/user/'+version+'/analysis/presence/'+ anUser+'/json'),
        apiR(url, '/user/'+version+'/analysis/distortion/'+ anUser+'/json')
    ]);
};

var testByPost= function(alli) {
    var aPost = _.sample(alli.exported[1]).postId;
    return Promise.all([
        apiR(url, '/post/top/'+version+'/'+ aPost),
        apiR(url, '/post/reality/'+version+'/'+ aPost)
    ]);
};

var testByUserPost = function(alli) {
    var aPostO = _.sample(alli.exported[1]);
    var aPost = aPostO.postId;
    var anUser = aPostO.userId;
    return apiR(url, '/post/perceived/'+version+'/'+aPost+'/'+anUser);
};

var testNode = function(alli) {
    return apiR(url, '/node/activity/'+version+'/json', true);
};


/* This is the beginning of everything */
return apiR(url, '/node/info/' + version)
.then(function(basicInfo) {
    return apiR(url, '/node/export/' + version + '/0')
    .tap(function(infos) {
        return testByUser(infos);
    })
    .tap(function(infos) {
        return testByPost(infos);
    })
    .tap(function(infos) {
        return testByUserPost(infos);
    })
    .tap(function(infos) {
        return testNode(infos);
    });
})
.tap(function(x) {
    console.log("You reach the end!");
});
