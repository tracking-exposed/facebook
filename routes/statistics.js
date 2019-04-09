const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');
const debug = require('debug')('routes:statistics');
const nconf = require('nconf');

const mongo = require('../lib/mongo');
const utils = require('../lib/utils');

function getStats(req) {
    var what = _.get(req.params, 'what');
    var months = _.parseInt(_.get(req.params, 'months')) || 2;
    debug("getStats on %s the last %d months", what, months);

    return mongo
        .read(nconf.get('schema').hourlyIO, {
            type: what,
            start: { "$gt": new Date(moment().subtract(months, 'months')) }
        })
        .map(function(o) {
            /* 'basic' and 'metadata' are treated equally */
            o.start = moment(o.start).format("YYYY-MM-DD HH") + ":00:00";
            return _.omit(o, ['_id', 'id', 'type']);
        })
        .then(function(ready) {
            debug("collected %d hourly entries", _.size(ready));
            return { json: ready };
        });
};

function getEngagement(req) {

    debug("getEngagement");
    return mongo
        .read(nconf.get('schema').supporters, {})
        .map(function(s) {
            var d = moment.duration(
                moment(s.lastActivity) - moment(s.keyTime)
            ).asDays();
            return {
                // userId: s.userId,
                endured: _.round(d, 0),
                lastActivity: s.lastActivity,
                keyTime: s.keyTime
            }
        })
        .then(function(all) {
            debug("getEngagement is returning %d entries", _.size(all));
            return { json: all };
        });
};

function computeStats(summary) {
    /* reduce summary content in few numbers for stats, they got
     * summed and updated by the updateHourly function below. invoked via .map */

    const iT = moment(summary.impressionTime);
    const pT = moment(summary.publicationTime);
    const vdiff = pT.isValid() ? _.round(moment.duration(iT - pT).asHours()) : 'na';
    const hourOnly = moment(summary.impressionTime).format("YYYY-MM-DD HH");
    const hourId = utils.hash({impressionTime: hourOnly });
    const textRANGES = _.reverse([50, 100, 150, 200, 250, 300 ]);

    const stat = {
        hourOnly: hourOnly,
        hourId,
        userhp: _.set({}, utils.smallhash({ hourId, userPseudo: summary.user }), 1),
        timelinehp: _.set({}, utils.smallhash({ hourId, timelinePseudo: summary.timeline }), 1),
        vdiff: _.set({}, vdiff, 1),
        validId: _.set({}, !!summary.postId, 1),
        permaLink: _.set({}, !!summary.permaLink, 1),
        attribution: _.set({}, !!summary.source, 1),
        sourcehp: summary.source ? _.set({}, utils.smallhash({ hourId, source: summary.source }), 1) : null,
        nature: _.set({}, summary.nature, 1),
        images: _.set({}, 'count', 1),
        captions: _.set({}, _.size(summary.images.captions), 1),
        type: _.set({}, summary.fblinktype, 1),
        textrange: _.set({}, _.find(textRANGES, function(r) { return r < summary.textsize; }), 1),
    }
    return stat;
};

function updateHourly(stats) {
    /* this function simple append and extend: do not care if a repeated analysis
     * is mixing the stats of the same metadata. If this is a problem, a separated
     * utility will reset the hourId and recompute it
     */

    let sa = _.groupBy(stats, 'hourId')
    let input = _.map(sa, function(statistics, hourId) {
        return {
            statistics,
            hourId,
            amount: _.size(statistics),
            hourOnly: statistics[0].hourOnly
        };
    });

    Promise.map(input, function(o) {
        debug("Processing hourId %s, stats in queue %d", o.hourId, o.amount);
        return mongo
            .readOne(nconf.get('schema').aggregated, { hourId: o.hourId })
            .then(function(e) {
                return _.reduce(o.statistics, function(memo, s, i) {
                    _.each(s, function(value, key) {
                        if(typeof value == 'object') {
                            memo = _.set(memo, key,
                                updateCounter(_.get(memo, key, {}), value)
                            );
                        }
                    });
                    // debug("step %d: %s", i+1, JSON.stringify(memo));
                    return memo;
                }, e ? e : {} );
            })
            .then(function(updated) {
                let hourAmount = _.get(updated, 'hourAmoun', 0);
                hourAmount += _.size(o.statistics);

                updated.hourAmount = hourAmount;
                updated.when = new Date();
                updated.hourId = o.hourId;
                updated.hourOnly = o.hourOnly;

                return mongo
                    .upsertOne(nconf.get('schema').aggregated, { hourId: updated.hourId }, updated);
            })
            .return(o.amount);
    }, { concurrency: 1})
    .tap(function(results) {
        debug("update chunks by hours, completed: %s", JSON.stringify(results));
    });
};

function updateCounter(start, addition) {
    let field = _.first(_.keys(addition));
    let value = _.first(_.values(addition));
    let current = _.get(start, field, 0);
    current += value;
    return _.set(start, field, current);
};

/* 
module.exports = {
    getStats: getStats,
    getEngagement: getEngagement,
    computeStats: computeStats,
    updateHourly: updateHourly,
    updateCounter: updateCounter,
};

*/

module.exports = {
    counter : function(req) { debug("not implemented: %j", req.params); },
    aggregated : function(req) { debug("not implemented: %j", req.params); },
    parsers : function(req) { debug("not implemented: %j", req.params); },
};
