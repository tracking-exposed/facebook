var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('lib:glue');
var nconf = require('nconf');
 
var mongo = require('./mongo');
var params = require('./params');

/* this function returns a random sample pick from the last 20 timelines,
 * with htmls+impressions. This is intended to replicate some of the freshly submitted timelines
 * and help parsing. By parameters the number 20 can be enlarged to 100. It returns one
 * timeline per time. duplication should be checked client side.
 *
 * the api is /api/v1/glue/$samplesize
 *
 * default $samplesize: 20
 */
function glue(req) {

    const DEFAULT_SAMPLE = 20;
    const MAX_SAMPLE = 100;
    var sample = params.getInt(req, 'sample') || DEFAULT_SAMPLE;

    if(sample > MAX_SAMPLE)
        sample = MAX_SAMPLE;

    return mongo
        .readLimit(nconf.get('schema').timelines, { nonfeed: { $exists: false }}, {}, sample, 0)
        .then(_.sample)
        .then(function(timeline) {
            debug("Looking for timeline %s", timeline.id);
            return Promise.all([
                mongo.read(nconf.get('schema').impressions, { timelineId: timeline.id }),
                mongo.read(nconf.get('schema').htmls, { timelineId: timeline.id }),
                timeline
            ]);
        })
        .then(function(results) {
            debug("Returning the timeline of %s %s, impressions %d, htmls %d",
                results[2].startTime,
                moment.duration(results[2].startTime).humanize(),
                _.size(results[0]),
                _.size(results[1])
            );
            return { json: results };
        });
};

module.exports = glue;
