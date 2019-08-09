#!/usr/bin/env node
const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('bin:count-o-clock');
const nconf= require('nconf');

const aggregated = require('../lib/aggregated');
const mongo = require('../lib/mongo3');
const utils = require('../lib/utils');

nconf.argv().env().file({ file: 'config/stats.json' });

const statsMap = nconf.get('stats');
const name = nconf.get('name');


async function computeCount(mongoc, statinfo, filter) {
    /* here each section of config/stats.json is processed,
     * this function is called twice: once with 'hour' filter
     * and another with 'day' */

    debug("HourCollection: [%s], named %s, has %d variables",
        statinfo.column,
        statinfo.name,
        _.size(statinfo.variables)
    );

    let counting = await _.map(statinfo.variables, async function(v) {
        const thisfilter = Object.assign({}, filter, v.selector);
        const amount = await mongo.count(mongoc, statinfo.column, thisfilter);
        return _.set({}, v.name, amount);
    });

    /* todo other kind of calculus which are not count */
    return await Promise
        .all(counting)
        .catch(function(error) {
            debug("Error in computeHourCount (%s): %s", statinfo.name, error.message);
        });
};


async function start() {
    const hoursago = utils.parseIntNconf('hoursago', 0);
    const statshour = moment().subtract(hoursago, 'h').format();
    const tobedone = name ? _.filter(statsMap, { name }) : statsMap;

    const mongoc = await mongo.clientConnect();

    debug("Loaded %d possible statistics %s: %d to be done", 
        _.size(statsMap), name ? `only ${name}` : "", _.size(tobedone));

    let statsp = await _.map(tobedone, async function(statinfo) {
        const hoursref = aggregated.hourData(statshour);
        const hourfilter = _.set({}, statinfo.timevar, {
            $gte: new Date(hoursref.reference),
            $lt: new Date(hoursref.hourOnext)
        });
        const hourC = await computeCount(mongoc, statinfo, hourfilter);
        debug("Hour computed %s: %j", statinfo.name, hourC);
        const entry = _.reduce(hourC, function(memo, e) {
            return _.merge(memo, e);
        }, {
            hourId: hoursref.hourId,
            hour: new Date(hoursref.hourOnly),
            name: statinfo.name
        });
        const rv1 = await mongo.upsertOne(mongoc, 'stats', { hourId: hoursref.hourId, name: statinfo.name }, entry);

        /* -- Day -- */
        const dayref = aggregated.dayData(statshour);
        const dayfilter = _.set({}, statinfo.timevar, {
            $gte: new Date(dayref.reference),
            $lt: new Date(dayref.dayOnext)
        });
        const dayC = await computeCount(mongoc, statinfo, dayfilter);
        debug("Day computed %s: %j", statinfo.name, dayC);
        const ready = _.reduce(dayC, function(memo, e) {
            return _.merge(memo, e);
        }, {
            dayId: dayref.dayId,
            day: new Date(dayref.dayOnly),
            name: statinfo.name
        });
        const rv2 = await mongo.upsertOne(mongoc, 'stats', { dayId: dayref.dayId, name: statinfo.name }, ready);
    });

    await Promise.all(statsp)
        .catch(function(error) {
            debug("Error in main function: %s", error.message);
        });

    await mongoc.close();
};

try {
    start();
} catch(error) {
    debug("Unexpected error: %s", error.message);
}


/*
const echoes = require('../lib/echoes');
echoes.addEcho("elasticsearch");
echoes.setDefaultEcho("elasticsearch");
 */
