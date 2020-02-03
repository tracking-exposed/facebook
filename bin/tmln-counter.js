#!/usr/bin/env node
const _ = require('lodash');
const moment = require('moment');
const tmlnd = require('debug')('bin:tmln-counter');
const debug = require('debug')('periodic timeline checker');
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
    if(hoursago < 24)
        debug("Warning: this script do not consider hour differencies, only the full day [trigger --hoursago < 24]");

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
    const timelines = [];
    
    for (userId of userPerDay) {
        const filter = _.assign(timeFilter, {"userId": userId});
        const t = await mongo.aggregate(mongoc, schema.timelines, [
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
        timelines.push(t);
    }

    const updates = _.reduce(timelines, groupByDay, []);
    for (update of updates) {
        try {
        let r = await mongo.upsertOne(
            mongoc, schema.tmlnstats, { id: update.id }, update );
        } catch(e) {
            debug("Error in upsertOne: %s", e.message);
        }
    }
    await mongoc.close();
    return _.size(updates);
}

function groupByDay(memo, timelinespu) {
    // timelines per user

    const extended = _.map(timelinespu, function(timeline) {
        timeline.dayString = moment(timeline.day).format("YYYY-MM-DD");
        timeline.durationSeconds = estimateDuration(timeline.impressions);
        return timeline;
    })

    const grouped = _.values(_.groupBy(extended, 'dayString'));

    const aggregated = _.map(grouped, function(dayr) {
        const metadatas = _.flatten(_.map(dayr, 'metadata'));
        const ntimelines = _.size(dayr);
        const npost = _.size(metadatas);
        const nature = _.countBy(metadatas, 'nature');
        const totalSeconds = _.round(_.sum(_.map(dayr, 'durationSeconds')), 0);
        const duration = moment.duration({ seconds: totalSeconds }).humanize();
        const sources = _.size(_.uniq(_.map(metadatas, function(m) {
            return m.attributions[0].content;
        })));

        return {
            day: dayr[0].dayString,
            dayTime: new Date(dayr[0].dayString),
            id: utils.hash({
                dayString: dayr[0].dayString,
                userId: timelinespu[0].userId,
                frequency: 'daily'
            }),
            ntimelines,
            npost,
            nature,
            totalSeconds,
            duration,
            sources,
            userId: timelinespu[0].userId,
        };
    });

    tmlnd("Aggregate answers from %d entries\taggregated in %d days, totalSeconds %d\tuser %d",
        _.size(timelinespu), _.size(grouped), aggregated[0].totalSeconds, timelinespu[0].userId );

    if(_.size(aggregated) != 1)
        debug("Unexpected behavior, only one day should be catch here (%d)", _.size(aggregated));
        /* but I'm keeping this check and the _.map above which can be O(1),
         * because I'm not so sure in regards of timezone */

    memo = _.concat(memo, aggregated);
    return memo;
}


async function execute() {
    try {
        let res1 = await dailyTimelines();
        debug("Completed %d timelines", res1);
    } catch(error) {
        debug("Unexpected error: %s", error.message);
    } finally {
        process.exit();
    }
};

execute();
