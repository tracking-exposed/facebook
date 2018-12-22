#!/usr/bin/env node
var Promise = require('bluebird');
var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('bin:parserv');
var nconf= require('nconf');

var mongo = require('../lib/mongo');
var parse = require('../lib/parse');

nconf.argv().env().file({ file: 'config/collector.json' });

const concur = _.isUndefined(nconf.get('concurrency') ) ? 1 : _.parseInt(nconf.get('concurrency') );
const FREQUENCY = 2; // seconds
var lastExecution = moment().subtract(10, 'minutes').toISOString();
var lastCycleActive = false;

function getLastActive() {

    return mongo
        .read(nconf.get('schema').supporters, { lastActivity: { $gt: new Date(lastExecution) }})
        .map(function(user) {
            return user.userId;
        });
}

function infiniteLoop() {
    /* this will launch other scheduled tasks too */
    return Promise
        .resolve()
        .delay(FREQUENCY * 1000)
        .then(getLastActive)
        .map(function(userId) {
            if(lastCycleActive)
                debug("Last successful execution was at %s", lastExecution);
            let htmlFilter = { userId: userId, savingTime: { $gt: new Date(lastExecution) }};
            return parse
                .parseHTML(htmlFilter, false);
        }, { concurrency: 1})
        .tap(function(results) {
            lastExecution = moment().toISOString();

            if(_.size(results)) {
                debug("updated lastExection: %s, results: %s",
                    lastExecution, JSON.stringify(results)
                );
                lastCycleActive = true;
            } else {
                lastCycleActive = false;
            }
        })
        .then(infiniteLoop);
};

infiniteLoop();
