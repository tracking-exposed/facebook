var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('routes:htmlunit');
var nconf = require('nconf');
 
var mongo = require('../lib/mongo');
var utils = require('../lib/utils');


function unitById(req) {
    // '/api/v2/debug/html/:htmlId'
    var htmlId = req.params.htmlId;

    debug("%s unitById %s", req.randomUnicode, htmlId);
    return Promise.all([
        mongo.readOne(nconf.get('schema').htmls, { id: htmlId }),
        mongo.readOne(nconf.get('schema').metadata, { id: htmlId }),
        mongo.readOne(nconf.get('schema').summary, { id: htmlId }),
        mongo.readOne(nconf.get('schema').errors, { id: htmlId }),
    ])
    .then(function(c) {
        return { json: {
            html: _.omit(c[0], ['_id']),
            metadata: _.omit(c[1], ['_id']),
            summary: _.omit(c[2], ['_id']),
            errors: _.omit(c[3], ['_id'])
        }};
    })
    .catch(function(error) {
        debug("error with html.id %s: %s", htmlId, error);
        return { json: 'Error' };
    });
};

function unitByDate(req) {
    // '/api/v2/debug/:key/date/:savingDay/:savingMinutes'
    // expected format is YYYY-MM-DD / HH:mm
    // this return a list of all the metadata recorded in a due period of 60 seconds
    const reft = new Date(req.params.savingTime);
    if(nconf.get('password') != req.params.dey)
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
