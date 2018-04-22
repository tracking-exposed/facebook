#!/usr/bin/env nodejs
var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var mongodb = Promise.promisifyAll(require('mongodb'));
var debug = require('debug')('userdelete');
var nconf = require('nconf');

var mongo = require('../lib/mongo');

var cfgFile = "config/settings.json";

nconf.argv()
     .env()
     .file({ file: cfgFile });

console.log("Checking variable 'id'");
var userId = _.parseInt(nconf.get('id'));
debug("userId is %d", userId);

if(!userId)
    process.exit(1);


return Promise
    .all([
        mongo.countByMatch(nconf.get('schema').supporters, { userId: userId }),
        mongo.countByMatch(nconf.get('schema').htmls, { userId: userId }),
        mongo.countByMatch(nconf.get('schema').impressions, { userId: userId }),
        mongo.countByMatch(nconf.get('schema').timelines, { userId: userId })
    ])
    .tap(function(every) {
        debug("Respective amount %j, waiting before deleting, 5s...", every);
    })
    .delay(5000)
    .then(function() {
        return Promise.all([
            mongo.remove(nconf.get('schema').supporters, { userId: userId }),
            mongo.remove(nconf.get('schema').htmls, { userId: userId }),
            mongo.remove(nconf.get('schema').impressions, { userId: userId }),
            mongo.remove(nconf.get('schema').timelines, { userId: userId })
        ])
    })
    .then(function(done) {
        debug("Done!");
    });
