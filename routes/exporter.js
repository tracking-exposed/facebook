const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('routes:exporter')
const nconf = require('nconf');
 
const mongo = require('../lib/mongo');
const params = require('../lib/params');
const glue = require('../lib/glue');
const adopters = require('../lib/adopters');
const utils = require('../lib/utils');

function pickByTimeline(timeline) {
    const pseudoTimeline = utils.pseudonymizeTmln(timeline.id);
    const pseudoUser = utils.pseudonymizeUser(timeline.userId);
    return Promise.all([
        mongo.read(nconf.get('schema').impressions, { timelineId: timeline.id }),
        mongo.read(nconf.get('schema').htmls, { timelineId: timeline.id }),
        timeline,
        mongo.read(nconf.get('schema').summary, { timeline: pseudoTimeline, user: pseudoUser }),
    ]);
};

/* this function returns a random sample pick from the last $paging timelines,
 * with htmls+impressions. This is intended to give back some of the freshly 
 * received timelines. handy when you are testing (or not trusting) parsers
 * The 'sample' parameters is the number in which a random sample is pick 
 * max is 1000, 
 * It returns one timeline per time. duplication should be checked client side.
 *
 * the api is /api/v2/glue/$password/$samplesize                           */

function exporter(req) {

    const DEFAULT_RANDOM_RANGE = 20;
    const MAX_RANDOM_RANGE = 1000;
    var sample = params.getInt(req, 'sample') || DEFAULT_RANDOM_RANGE;
    var key = params.getString(req, 'key');

    if( key !== nconf.get('password') ) {
        debug("Authentication failure, password mismatch");
        return { text: "key error" };
    }

    if(sample > MAX_RANDOM_RANGE)
        sample = MAX_RANDOM_RANGE;

    return mongo
        .readLimit(nconf.get('schema').timelines, { nonfeed: { $exists: false }}, { startTime: -1}, sample, 0)
        .then(_.sample)
        .then(pickByTimeline)
        .then(function(results) {
            debug("Selected timeline of %s %s, impressions %d, htmls %d, summaries %d",
                results[2].startTime,
                moment.duration( moment(results[2].startTime) - moment() ).humanize(),
                _.size(results[0]),
                _.size(results[1]),
                _.size(results[3])
            );
            return { json: results };
        });
};

function personal(req) {

    const { amount, skip } = params.optionParsing(req.params.paging, 20);
    const userToken = params.getString(req, 'userToken');

    debug("personal export requested: amount of timelines %d skip %d", amount, skip);
    return adopters
        .validateToken(req.params.userToken)
        .then(function(supporter) {
            return mongo
                .readLimit(nconf.get('schema').timelines, { userId: supporter.userId }, { startTime: -1}, amount, skip);
        })
        .map(pickByTimeline, { concurrency: 2 })
        .then(function(results) {
            debug("Exporting %d timelines, impressions %d, htmls %d, summaries %d",
                _.size(results),
                _.sum(_.map(results, function(e) { return _.size(e[0]) } )),
                _.sum(_.map(results, function(e) { return _.size(e[1]) } )),
                _.sum(_.map(results, function(e) { return _.size(e[3]) } )),
            );
            return { json: results };
        });
};

module.exports = {
    exporter : exporter,
    personal: personal,
};
