const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');
const debug = require('debug')('lib:aggregated');
const nconf = require('nconf');

const mongo = require('./mongo');
const utils = require('./utils');

function hourData(reference) {
    const fmt = "YYYY-MM-DD HH:00:00";
    if(!reference)
        reference = moment().format("YYYY-MM-DD HH:00:00");

    const m = moment(reference);
    const hourOnly = m.format("YYYY-MM-DD HH:00:00");
    const hourId = utils.hash({impressionTime: hourOnly });

    return {
        hourOnly: new Date(hourOnly),
        hourId,
        reference: hourOnly,
        m: m,
    };
}

function computeStats(summary) {
    /* reduce summary content in few numbers for stats, they got
     * summed and updated by the updateHourly function below.
     * invoked via .map */

    const iT = moment(summary.impressionTime);
    const pT = moment(summary.publicationTime);
    const vdiff = pT.isValid() ? _.round(moment.duration(iT - pT).asHours()) : 'na';
    const hourInfo = hourData(summary.impressionTime);
    const textRANGES = _.reverse([50, 100, 150, 200, 250, 300 ]);

    const stat = {
        hourOnly: hourInfo.hourOnly,
        hourId: hourInfo.hourId,
        userhp: _.set({}, utils.smallhash({
            hourId: hourInfo.reference,
            userPseudo: summary.user
        }), 1),
        timelinehp: _.set({}, utils.smallhash({
            hourId: hourInfo.reference,
            timelinePseudo: summary.timeline
        }), 1),
        vdiff: _.set({}, vdiff, 1),
        validId: _.set({}, !!summary.postId, 1),
        permaLink: _.set({}, !!summary.permaLink, 1),
        attribution: _.set({}, !!summary.source, 1),
        sourcehp: summary.source ? _.set({}, utils.smallhash({
            hourId: hourInfo.reference,
            source: summary.source
        }), 1) : null,
        nature: _.set({}, summary.nature, 1),
        images: _.set({}, 'count', 1),
        captions: _.set({}, _.size(summary.images.captions), 1),
        type: _.set({}, summary.fblinktype, 1),
        textrange: _.set({}, _.find(textRANGES, function(r) {
            return r < summary.textsize;
        }), 1),
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
                let hourAmount = _.get(updated, 'hourAmount', 0);
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

module.exports = {
    computeStats,
    updateHourly,
    updateCounter,
    hourData,
};
