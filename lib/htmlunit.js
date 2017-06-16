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
            debug("Handle error accordingly -- Id fail: %s", error);
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
    unitById:unitById
};
