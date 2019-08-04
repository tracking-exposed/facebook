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


async function computeHourCount(mongoc, statinfo, hoursref) {

    const filter = _.set({}, statinfo.timevar, {
        $gte: new Date(hoursref.reference),
        $lt: new Date(hoursref.hourOnext)
    });

    debug("stats on [%s], named %s, has %d variables",
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
    const hoursref = aggregated.hourData(statshour);
    const tobedone = name ? _.filter(statsMap, { name }) : statsMap;

    debug("Loaded %d possible statistics, specific request: %s, %d to be done",
        _.size(statsMap), name ? name : "[unset]", _.size(tobedone));

    const mongoc = await mongo.clientConnect();

    let statsp = await _.map(tobedone, async function(statinfo) {
        let results = await computeHourCount(mongoc, statinfo, hoursref);
        debug("Computed %s: %j", statinfo.name, results);
        const entry = _.reduce(results, function(memo, e) {
            return _.merge(memo, e);
        }, {
            hourId: hoursref.hourId,
            hour: new Date(hoursref.hourOnly),
            name: statinfo.name
        });
        const rv = await mongo.upsertOne(mongoc, 'stats', { hourId: hoursref.hourId, name: statinfo.name }, entry);
        debug("Completed upsert in %s", entry.name);
    });

    await Promise.all(statsp)
        .catch(function(error) {
            debug("Error in main function: %s", error.message);
        });

    await mongoc.close();

    debug("done")
};

try {
    start();
} catch(error) {
    debug("Unexpected error: %s", error.message);
}


/*
 * timelines feed 
impressions private or not 
htmls2: processed or not
metadata: niente. si conteggia status
"attributions" : 1,
"commentable" : 1,
"adinfo" : 0,
"texts" : 0,
"externalLinks" : 0,
"commentsLinks" : 0,
"linkontime" : 1,
"alt" : 1,
"reasons" : 0,
"sharer" : 0,
"sharedContent" : 0

accesses2: distinct su ccode
summary: distinct su user

[
	"accesses2",
	"alarms",
	"entities",
	"feeds",
	"finalized",
	"haha",
	"htmls2",
	"impressions2",
	"labels",
	"metadata",
	"opendata1",
	"parsererrors",
	"parserstats",
	"performa",
	"reality",
	"semantics",
	"summary",
	"summaryCopy",
	"supporters2",
	"timelines2"
]

--- NON salvare mai le cose a 0.

*/

/*
const echoes = require('../lib/echoes');
echoes.addEcho("elasticsearch");
echoes.setDefaultEcho("elasticsearch");
 */
