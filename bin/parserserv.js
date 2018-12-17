#!/usr/bin/env node
var Promise = require('bluebird');
var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('bin:parserserv');
var nconf= require('nconf');

var mongo = require('../lib/mongo');
var parse = require('../lib/parse');

nconf.argv().env().file({ file: 'config/collector.json' });

const concur = _.isUndefined(nconf.get('concurrency') ) ? 1 : _.parseInt(nconf.get('concurrency') );
const FREQUENCY = 2; // seconds
var lastExecution = moment().subtract(10, 'minutes').toISOString();

function getLastActive() {

    return mongo
        .read(nconf.get('schema').supporters, { lastActivity: { $gt: new Date(lastExecution) } })
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
            debug("Last execution is %s", lastExecution);
            let htmlFilter = { userId: userId, savingTime: { "$gt": new Date(lastExecution) }};
            return parse
                .parseHTML(htmlFilter, false);
        }, { concurrency: 1})
        .then(function(results) {
            debug("results: %j", results);
            lastExecution = moment().toISOString();
            debug("updated lastExection: %s", lastExecution);
        })
        .then(infiniteLoop);
};

infiniteLoop();
