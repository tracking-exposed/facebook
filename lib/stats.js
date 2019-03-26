var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:stats');
var nconf = require('nconf');
 
var mongo = require('./mongo');
var utils = require('./utils');

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
    /* this function reduced summary content in few numbers, they get
     * updated by the mongo.update wrapped below (updateHourly) */

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
        images: _.set({}, summary.images.count, 1),
        captions: _.set({}, _.size(summary.images.captions), 1),
        type: _.set({}, summary.fblinktype, 1),
        textrange: _.set({}, _.find(textRANGES, function(r) { return r < summary.textsize; }), 1),
        // links: _.set({}, _.size(summary. e texts
    }
    return stat;
};

function updateHourly(stats) {
    /* this function simple append and extend: do not care if a repeated analysis
     * is mixing the stats of the same metadata. If this is a problem, a separated
     * utility will reset the hourId and recompute it
     */

    var sa = _.groupBy(stats, 'hourId')
    debugger;
};

function updateCounter(start, addition, field) {
    let current = _.get(start, field, 0);
    current += _.get(addition, field, 0);
    return _.set(start, field, current);
};

module.exports = {
    getStats: getStats,
    getEngagement: getEngagement,
    computeStats: computeStats,
    updateHourly: updateHourly,
    updateCounter: updateCounter,
};
