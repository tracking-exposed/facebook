const _ = require('lodash');
const debug = require('debug')('routes:remove')
const nconf = require('nconf');
 
const mongo = require('../lib/mongo');
const params = require('../lib/params');
const utils = require('../lib/utils');
const adopters = require('../lib/adopters');

function removeByTimeline(timeline) {
    const pseudoTimeline = utils.pseudonymizeTmln(timeline.id);
    const pseudoUser = utils.pseudonymizeUser(timeline.userId);
    return Promise.all([
        mongo.remove(nconf.get('schema').timelines, { id: timeline.id }),
        mongo.remove(nconf.get('schema').impressions, { timelineId: timeline.id }),
        mongo.remove(nconf.get('schema').htmls, { timelineId: timeline.id }),
        mongo.remove(nconf.get('schema').summary, { timeline: pseudoTimeline, user: pseudoUser }),
    ]);
};

function remove(req) {
    const { amount, skip } = params.optionParsing(req.params.paging, 1);
    const userToken = params.getString(req, 'userToken');

    debug("personal remove function: amount of timelines %d skip %d", amount, skip);
    return adopters
        .validateToken(userToken)
        .then(function(supporter) {
            return mongo
                .readLimit(nconf.get('schema').timelines, { userId: supporter.userId }, { startTime: -1}, amount, skip);
        })
        .map(removeByTimeline, { concurrency: 2 })
        .then(function(results) {
            const retval = {
                timelines: _.sum(_.map(results, function(e) { return e[0] } )),
                impressions: _.sum(_.map(results, function(e) { return e[1] } )),
                htmls: _.sum(_.map(results, function(e) { return e[2] } )),
                summaries: _.sum(_.map(results, function(e) { return e[3] } ))
            }
            echoes.echo(_.extend({ index: 'remove' }, retval));
            return { json: retval };
        });
};

module.exports = {
    remove: remove,
};
