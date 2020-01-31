#!/usr/bin/env node
const _ = require('lodash');
const moment = require('moment');
const statsd = require('debug')('bin:count-o-clock:stats');
const debug = require('debug')('bin:count-o-clock');
const nconf= require('nconf');

const aggregated = require('../lib/aggregated');
const mongo = require('../lib/mongo3');
const utils = require('../lib/utils');

nconf.argv().env();
const defaultConf = nconf.get('config') || 'config/content.json';
nconf.file({ file: defaultConf });
const schema = nconf.get('schema');
nconf.file({ file: 'config/trexstats.json' });
const name = nconf.get('name');


async function computeCount(mongoc, statinfo, filter) {
    /* here each section of config/stats.json is processed,
     * this function is called twice: once with 'hour' filter
     * and another with 'day' */

    const counts = {};
    for (v of statinfo.variables) {
        let thisfilter = Object.assign({}, filter, v.selector);
        let amount = await mongo.count(mongoc, statinfo.column, thisfilter);
        _.set(counts, v.name, amount);
    }
    return counts;
};

async function trexstats() {
    const statsMap = nconf.get('stats');
    const hoursago = utils.parseIntNconf('hoursago', 0);
    const statshour = moment().subtract(hoursago, 'h').format();
    const tobedone = name ? _.filter(statsMap, { name }) : statsMap;
    const mongoc = await mongo.clientConnect();

    statsd("Loaded %d possible statistics%s: %d to be done",
        _.size(statsMap), name ? `, demanded '${name}'` : "", _.size(tobedone));

    /* Hours count */
    for (statinfo of tobedone) {
        const hoursref = aggregated.hourData(statshour);
        const hourfilter = _.set({}, statinfo.timevar, {
            $gte: new Date(hoursref.reference),
            $lt: new Date(hoursref.hourOnext)
        });
        const hourC = await computeCount(mongoc, statinfo, hourfilter);

        statsd("Hour computed %s: %j", statinfo.name, hourC);
        const entry = _.reduce(hourC, function(memo, amount, name) {
            _.set(memo, name, amount);
            return memo;
        }, {
            hourId: hoursref.hourId,
            hour: new Date(hoursref.hourOnly),
            name: statinfo.name
        });
        await mongo.upsertOne(mongoc, schema.stats, { hourId: hoursref.hourId, name: statinfo.name }, entry);
    }

    /* -- Day count -- */
    for (statinfo of tobedone) {
        const dayref = aggregated.dayData(statshour);
        const dayfilter = _.set({}, statinfo.timevar, {
            $gte: new Date(dayref.reference),
            $lt: new Date(dayref.dayOnext)
        });
        const dayC = await computeCount(mongoc, statinfo, dayfilter);
        statsd("Day computed %s: %j", statinfo.name, dayC);
        const ready = _.reduce(dayC, function(memo, amount, name) {
            _.set(memo, name, amount);
            return memo;
        }, {
            dayId: dayref.dayId,
            day: new Date(dayref.dayOnly),
            name: statinfo.name
        });
        await mongo.upsertOne(mongoc, schema.stats, { dayId: dayref.dayId, name: statinfo.name }, ready);
    };

    await mongoc.close();
};

/* counter of time expent on facebook. 
 * count only the last day active users, consider only the last day, saves on dedicated collection */
function estimateDuration(impressions) {
    const f = _.first(impressions);
    const l = _.last(impressions);

    if(!f || !l || l.id == f.id)
        return 0;

    return moment.duration(
        moment(l.impressionTime) - moment(f.impressionTime)
    ).asSeconds();
};

async function execute() {
    try {
        debug("Starting execution with %d hoursago", utils.parseIntNconf('hoursago', 0));
        let res2 = await trexstats();
    } catch(error) {
        debug("Unexpected error: %s", error.message);
    } finally {
        process.exit();
    }
};

execute();

/*
const echoes = require('../lib/echoes');
echoes.addEcho("elasticsearch");
echoes.setDefaultEcho("elasticsearch");
 */
