#!/usr/bin/env nodejs
var _ = require('lodash');
var Promise = require('bluebird');
var util = require('util');
var fs = Promise.promisifyAll(require('fs'));
var request = Promise.promisifyAll(require('request'));
var debug = require('debug')('importer');
var nconf = require('nconf');
var mongo = require('../lib/mongo');

var version = 2;
var cfgFile = "config/settings.json";

nconf.argv().env().file({ file: cfgFile });

if(_.isUndefined(nconf.get('source'))) {
    console.log("lacking of 'source' server");
    throw new Error();
}

var impoexporter = function(shardN) {
    var exportUrl = nconf.get('source') + '/node/export/' + version + 
          '/' + shardN;
    debug("Calling impoexporter of shard %d %s", shardN, exportUrl);
    return request.getAsync({
        url: exportUrl
    })
    .then(function(received) {
        return received.body;
    })
    .then(JSON.parse)
    .tap(function(content) {
        var supTOK = _.map(content.exported[0], function(e) {
            e.lastInfo = new Date(e.lastInfo);
            return e;
        });
        if(_.size(supTOK))
            return mongo.writeMany(nconf.get('schema').supporters, supTOK);
    })
    .tap(function(content) {
        var timTOK = _.map(content.exported[1], function(e) {
            e.displayTime = new Date(e.displayTime);
            e.creationTime = new Date(e.creationTime);
            return e;
        });
        if(_.size(timTOK))
            return mongo.writeMany(nconf.get('schema').timeline, timTOK);
    })
    .tap(function(content) {
        var refTOK = _.map(content.exported[2], function(e) {
            e.refreshTime = new Date(e.refreshTime);
            return e;
        });
        if(_.size(refTOK))
            return mongo.writeMany(nconf.get('schema').refreshes, refTOK);
    })
    .tap(function() {
        debug("Completed shard %d", shardN);
    });
};

return request.getAsync({
    url: nconf.get('source') + '/node/info/' + version
})
.then(function(result) {
    return result.body;
})
.then(JSON.parse)
.then(function(nodeInfo) {
    debug("Iterating over %d shards", nodeInfo.shards);
    return Promise.each(_.times(nodeInfo.shards), impoexporter);
});
