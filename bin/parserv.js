#!/usr/bin/env node
const Promise = require('bluebird');
const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('bin:parserv');
const nconf= require('nconf');

const mongo = require('../lib/mongo');
const parse = require('../lib/parse');
const echoes = require('../lib/echoes');

nconf.argv().env().file({ file: 'config/collector.json' });

const concur = _.isUndefined(nconf.get('concurrency') ) ? 1 : _.parseInt(nconf.get('concurrency') );
const FREQUENCY = 2; // seconds

const backInTime = _.parseInt(nconf.get('minutesago')) ? _.parseInt(nconf.get('minutesago')) : 10;
console.log(`considering the product since ${backInTime} minutes ago, [minutesago] overrides`);

var lastExecution = moment().subtract(backInTime, 'minutes').toISOString();
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
                logActivity(results);
            } else {
                lastCycleActive = false;
            }
        })
        .then(infiniteLoop);
};

function logActivity(results) {
    /* results contain an aggregated sum, such as:
       [ {
        "metadata": 8,
        "errors": 0
       } ]                                         */
    echoes.echo({
        id: Math.round((new Date()).getTime() / 1000),
        success: _.first(results).metadata,
        errors: _.first(results).errors,
        completedAt: new Date()
    });
};

infiniteLoop();
