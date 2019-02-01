var _ = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('lib:tagId');
var moment = require('moment');
var nconf = require('nconf');
var fs = Promise.promisifyAll(require('fs'));

var utils = require('../lib/utils');
var mongo = require('../lib/mongo');


/* this used case is 'Barcellona' 

if(pattern)
    var re = new RegExp(pattern, 'i');
  ____ this goes in _.map(combos[0])
if(pattern) {
    var bool = html.html.match(re) ? true: false;
    _.set(x, pattern, bool);
}
 */

function acquireTimeline(timeline, _i, _o, specialKeepFields) {

    let ptim = utils.pseudonymizeTmln(timeline.id);
    return mongo.read(nconf.get('schema').summary, {
        timeline: ptim
    })
    .map(function(summary) {

        summary.geoip = timeline.geoip;
        if(timeline.tagId)
            summary.tagId = timeline.tagId;

        return summary;
    })
    .tap(function(x) {
        debug("getTimelines from %s timelineId: %d public impressions", timeline.id, _.size(x));
    });
}

/* the high-level exported function, used in lib/research.js */
function getTimelines(filter) {
    debug("getTimeline selected by %s (%s)",
            _.get(filter, 'userId') ? 'userId' : 'tagId',
            _.get(filter, 'userId') ? filter.userId : filter.tagId
    );
    return mongo
        .read(nconf.get('schema').timelines, filter, { startTime: -1 })
        .map(acquireTimeline, { concurrency: 1});
};

module.exports = {
    getTimelines: getTimelines,
    acquireTimeline: acquireTimeline
};
