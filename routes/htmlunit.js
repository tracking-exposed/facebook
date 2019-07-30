var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('routes:htmlunit');
var nconf = require('nconf');
 
var mongo = require('../lib/mongo');

function unitById(req) {
    var htmlId = req.params.htmlId;

    debug("unitById /api/v2/debug/html/%s [would query in 6 collections]", htmlId);
    return mongo
        .readOne(nconf.get('schema').htmls, { id: htmlId })
        .then(function(html) {
            if(!html || !html.id)
                return { json: { error: `unable to retrive ${htmlId}` }};

            /* and this is compatible via routes/exporter */
            return Promise.all([
                html,
                mongo.readOne(nconf.get('schema').metadata, { id: htmlId }),
                mongo.readOne(nconf.get('schema').summary, { id: htmlId }),
                mongo.readOne(nconf.get('schema').errors, { id: htmlId }),
                mongo.readOne(nconf.get('schema').impressions, { htmlId: html.id }),
                mongo.readOne(nconf.get('schema').timelines, { id: html.timelineId })
            ])
            .then(function(cont) {
                return { json: {
                    html: _.omit(cont[0], ['_id']),
                    metadata: _.omit(cont[1], ['_id']),
                    summary: _.omit(cont[2], ['_id']),
                    errors: _.omit(cont[3], ['_id']),
                    impression: _.omit(cont[4], ['_id']),
                    timeline: _.omit(cont[5], ['_id'])
                }};
            });
        })
        .catch(function(error) {
            debug("error with html.id %s: %s", htmlId, error.stack);
            return { json: { error: error.message }};
        });
};

function unitByDate(req) {
    // This API is not used or has never been used.
    //
    // '/api/v2/debug/:key/date/:savingDay/:savingMinutes'
    // expected format is YYYY-MM-DD / HH:mm
    // this return a list of all the metadata recorded in a due period of 60 seconds
    const reft = new Date(req.params.savingTime);
    if(nconf.get('password') != req.params.key)
        return { json: "wrong key" };

    return mongo.readLimit(nconf.get('schema').htmls, {
        savingTime: {}
    }, { savingTime: 1 }, 1, 0)
        .then(_.first)
        .then(function(x) {
            return {
                'html': x.html,
                'metadata': _.omit(x, [
                    '_id', 'timelineId',
                    'userId', 'impressionId', 'html' ])
            };
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
    verifyTimeline: verifyTimeline,
    unitByDate: unitByDate,
};