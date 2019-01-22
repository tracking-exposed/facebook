var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:htmlunit');
var nconf = require('nconf');
 
var mongo = require('./mongo');
var utils = require('./utils');


function unitById(req) {
    var htmlId = req.params.htmlId;

    debug("%s unitById %s", req.randomUnicode, htmlId);
    return jsonifyImpression({ id: htmlId})
        .catch(function(error) {
            debug("%s error with html.id %s: %s",
                    req.randomUnicode, htmlId, error);
            return { json: 'Error' };
        });
};

function jsonifyImpression(mongoFilter, increment) {
    increment = (increment > 0) ? increment : 0;

    /* TODO talk with some security expert to get proper insight 
     * on how to handle this pandora's box */
    return mongo
        .readLimit(nconf.get('schema').htmls, mongoFilter, { savingTime: -1 }, 1, increment)
        .then(_.first)
        .then(function(fullc) {
            return {
                'html': fullc.html,
                'metadata': _.omit(fullc, [
                    '_id', 'timelineId',
                    'userId', 'impressionId', 'html' ])
            };
        })
        .then(function(c) {
            return { json: c };
        }); 
}

function verifyTimeline(req) {
    const tId = req.params.timelineId;
    debug("verifyTimeline of %s", tId);
    return Promise.all([
        mongo.read(nconf.get('schema').htmls, { timelineId: tId }),
        mongo.read(nconf.get('schema').metadata, { timelineId: tId }),
        mongo.read(nconf.get('schema').errors, { timelineId: tId })
    ])
    .then(function(results) {
        debug("-> %d htmls %d metadata %d errors",
            _.size(results[0]), _.size(results[1]), _.size(results[2]));
        return { json:
            _.map(_.map(results[0], 'id'), function(id) {
                return {
                    html: _.find(results[0], { id: id }),
                    metadata: _.find(results[1], { id: id }),
                    error: _.find(results[2], { id: id })
                };
            })
        };
    });
}

module.exports = {
    unitById :unitById,
    verifyTimeline: verifyTimeline
};
