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

/* 
module.exports = {
    getStats: getStats,
    getEngagement: getEngagement,
};

*/

module.exports = {
    counter : function(req) { debug("not implemented: %j", req.params); },
    aggregated : function(req) { debug("not implemented: %j", req.params); },
    parsers : function(req) { debug("not implemented: %j", req.params); },
};
