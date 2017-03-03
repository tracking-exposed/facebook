#!/usr/bin/env nodejs
var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('0001-supporters');
var moment = require('moment');
var nconf = require('nconf');

var mongo = require('../lib/mongo');

var cfgFile = "config/settings.json";
nconf.argv().env().file({ file: cfgFile });


function takeTheGood(memo, user) {

    if(_.isUndefined(user.publicKey))
        return memo;

    var good = {
        publicKey:  user.publicKey,
        keyTime: new Date(moment(user.keyTime).toISOString()),
        lastActivity: new Date(moment(user.lastInfo).toISOString()),
        userId: _.parseInt(user.userId)
    };
    memo.push(good);
    return memo;
};

function howMany(lst) {
    debug("Now we've %d elements", _.size(lst));
};

function saveTheGood(good) {
    return mongo
        .read('supporters2', {userId: good.userId})
        .then(function(empty) {
            if(empty && empty[0] && empty[0].userId) 
                return false;
            else
                return mongo
                    .writeOne('supporters2', good)
                    .return(true);
        });
};

function conversion() {
    return mongo
        .read('supporters', {}, {})
        .tap(howMany)
        .reduce(takeTheGood, [])
        .tap(howMany)
        .map(saveTheGood)
        .then(function(results) {
            debug("Written %j", _.countBy(results, function(e) { return e; }) );
        });
};

return conversion();
