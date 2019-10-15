#!/usr/bin/env node
const _ = require('lodash');
const moment = require('moment');
const statsd = require('debug')('bin:count-o-clock:stats');
const tmlnd = require('debug')('bin:count-o-clock:tmln');
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

    /* debug("HourCollection: [%s], named %s, has %d variables",
        statinfo.column, statinfo.name, _.size(statinfo.variables)); */

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

async function trexstats() {
    const statsMap = nconf.get('stats');
    const hoursago = utils.parseIntNconf('hoursago', 0);
    const statshour = moment().subtract(hoursago, 'h').format();
    const tobedone = name ? _.filter(statsMap, { name }) : statsMap;
    const mongoc = await mongo.clientConnect();

    statsd("Loaded %d possible statistics%s: %d to be done",
        _.size(statsMap), name ? `, demanded '${name}'` : "", _.size(tobedone));

    let statsp = await _.map(tobedone, async function(statinfo) {
        const hoursref = aggregated.hourData(statshour);
        const hourfilter = _.set({}, statinfo.timevar, {
            $gte: new Date(hoursref.reference),
            $lt: new Date(hoursref.hourOnext)
        });
        const hourC = await computeCount(mongoc, statinfo, hourfilter);
        statsd("Hour computed %s: %j", statinfo.name, hourC);
        const entry = _.reduce(hourC, function(memo, e) {
            return _.merge(memo, e);
        }, {
            hourId: hoursref.hourId,
            hour: new Date(hoursref.hourOnly),
            name: statinfo.name
        });
        const rv1 = await mongo.upsertOne(mongoc, schema.stats, { hourId: hoursref.hourId, name: statinfo.name }, entry);

        /* -- Day -- */
        const dayref = aggregated.dayData(statshour);
        const dayfilter = _.set({}, statinfo.timevar, {
            $gte: new Date(dayref.reference),
            $lt: new Date(dayref.dayOnext)
        });
        const dayC = await computeCount(mongoc, statinfo, dayfilter);
        statsd("Day computed %s: %j", statinfo.name, dayC);
        const ready = _.reduce(dayC, function(memo, e) {
            return _.merge(memo, e);
        }, {
            dayId: dayref.dayId,
            day: new Date(dayref.dayOnly),
            name: statinfo.name
        });
        const rv2 = await mongo.upsertOne(mongoc, schema.stats, { dayId: dayref.dayId, name: statinfo.name }, ready);

    });

    const updates = await Promise.all(statsp)
        .catch(function(error) {
            debug("Error in main function: %s", error.message);
        });

    await mongoc.close();
    return updates;
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

async function dailyTimelines() {
    const hoursago = utils.parseIntNconf('hoursago', 0);
    const statshour = moment().subtract(hoursago, 'h').format();
    const mongoc = await mongo.clientConnect();
    const dayref = aggregated.dayData(statshour);
    const timeFilter = {
        startTime: {
            $gte: new Date(dayref.reference),
            $lt: new Date(dayref.dayOnext)
        }
    };

    const userPerDay = await mongo.distinct(
        mongoc,
        schema.timelines,
        "userId",
        timeFilter );

    tmlnd("Users active in [%j] = %d", timeFilter, _.size(userPerDay));

    const updates = await _.reduce(userPerDay, async function(memo, userId) {

        const filter = _.assign(timeFilter, {"userId": userId});
        const mr = await mongo.aggregate(mongoc, schema.timelines, [
            { $match: filter },
            { $group: { _id: {
                    year:  { $year: "$startTime" },
                    month: { $month: "$startTime" },
                    day:   { $dayOfMonth: "$startTime" },
                    userId: "$userId"
                },
                day: { $first: "$startTime" },
                ids: { $addToSet: "$id" },
            }},
            { $project: { userId: "$_id.userId", count: "$_id.count", day: true, "timelineId": "$ids", _id: false }},
            { $sort: { day: -1 }},
            { $unwind: "$timelineId" },
            { $lookup: { from: 'metadata', localField: 'timelineId', foreignField: 'timelineId', as: 'metadata'}},
            { $lookup: { from: 'impressions2', localField: 'timelineId', foreignField: 'timelineId', as: 'impressions'}}
        ]);

        const extended = _.map(mr, function(timeline) {
            timeline.dayString = moment(timeline.day).format("YYYY-MM-DD");
            timeline.durationSeconds = estimateDuration(timeline.impressions);
            return timeline;
        })

        const grouped = _.values(_.groupBy(extended, 'dayString'));

        tmlnd("aggregate answers from %d, %d entries, aggregated in %d days",
            userId, _.size(mr), _.size(grouped) );

        const aggregated = _.map(grouped, function(dayr) {

            // TODO refactor
            // save in evests already the pseudoaninymized timeline name 
            // TODO THEN -- query summary this would make simpler the sums below.

            const metadatas = _.flatten(_.map(dayr, 'metadata'));
            const ntimelines = _.size(dayr);
            const npost = _.size(metadatas);
            const nature = _.countBy(metadatas, 'nature');
            const totalSeconds = _.sum(_.map(dayr, 'durationSeconds'));
            const duration = moment.duration({ seconds: totalSeconds }).humanize();
            const sources = _.size(_.uniq(_.map(metadatas, function(m) {
                return m.attributions[0].content;
            })));

            return {
                day: dayr[0].dayString,
                dayTime: new Date(dayr[0].dayString),
                id: utils.hash({
                    dayString: dayr[0].dayString,
                    userId: userId,
                    frequency: 'daily'
                }),
                ntimelines,
                npost,
                nature,
                totalSeconds,
                duration,
                sources,
                userId: userId,
            };
        });

        if(_.size(aggregated) != 1)
            debug("Unexpected behavior, only one day should be catch here (%d)", _.size(aggregated));

        try {
            let r = await mongo.upsertOne(
                mongoc, schema.tmlnstats, { id: aggregated[0].id }, aggregated[0] );
            return _.concat(memo, r);
        } catch(error) {
            tmlnd("upsertOne error: %d - %s", aggregated[0].userId, error.message);
            return _.concat(memo, null);
        }

    }, [] );

    return Promise.all(updates)
        .then(function() {
            mongoc.close();
            return updates;
        });
}


async function execute() {
    try {
        debug("Starting execution with %d hoursago", utils.parseIntNconf('hoursago', 0));
        let res1 = await dailyTimelines();
        let res2 = await trexstats();
        if(!res1 || !res2)
            debug("Error?");
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
