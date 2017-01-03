var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:htmlunit');
var nconf = require('nconf');
 
var mongo = require('./mongo');
var utils = require('./utils');


function unitByCoordinates(req) {
    var userId = _.parseInt(req.params.userId);
    var timelineUUID = _.parseInt(req.params.timelineUUID);
    var order = _.parseInt(req.params.order);
    var impressionId = utils.hash({
        'uuid': timelineUUID,
        'user': userId,
        'order': order
    });

    debug("%s unitByCoordinated %d+%d+%d %s",
        req.randomUnicode, userId, timelineId, order, impressionId);

    return jsonifyImpression({impressionId: impressionId})
        .catch(function(error) {
            debug("Handle error accordingly -- coordinates fail: %s", error);
            return { json: 'Error' };
        });
};

function unitByDays(req) {
    var daysAgo = _.parseInt(req.params.days);
    var increment = _.parseInt(req.params.increment);
    var when = moment().subtract(daysAgo, 'd').toISOString();

    debug("%s unitByDays %d+%d", req.randomUnicode, daysAgo, increment);

    return jsonifyImpression({
                savingTime: { "$lt" : new Date(when) }
        }, increment)
        .catch(function(error) {
            debug("Handle error accordingly -- coordinates fail: %s", error);
            return { json: 'Error' };
        });
};

function unitById(req) {
    var htmlId = req.params.htmlId;

    debug("%s unitById %s", req.randomUnicode, htmlId);
    return jsonifyImpression({ id: htmlId})
        .catch(function(error) {
            debug("Handle error accordingly -- coordinates fail: %s", error);
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

module.exports = {
    unitByCoordinates:unitByCoordinates,
    unitByDays:unitByDays,
    unitById:unitById
};
