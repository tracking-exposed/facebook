var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:fbtrexdebug');
var nconf = require('nconf');

var mongo = require('./mongo');
var utils = require('./utils');

function serve(req) {

    const sample = 10;

    if( _.get(req.params, 'key') !== nconf.get('password') ) {
        debug("Authentication failure, password mismatch");
        return { text: "key error" };
    }

    debug("Invoking 5 recent updates for debug");
    return Promise.all([
        mongo.readLimit(nconf.get('schema').impressions, {}, { impressionTime: -1 }, 10, 0),
        mongo.readLimit(nconf.get('schema').timelines, {}, { startTime: -1 }, 10, 0),
        mongo.readLimit(nconf.get('schema').metadata, {}, { impressionTime: -1 }, 10, 0),
        mongo.readLimit(nconf.get('schema').summary, {}, { impressionTime: -1 }, 10, 0),
        mongo.readLimit(nconf.get('schema').labels, {}, { when: -1 }, 10, 0),
    ])
    .then(function(x) {
        return {
            json: {
                impressions: x[0],
                timelines: x[1],
                metadata: x[2],
                summary: x[3],
                labels: x[4]
            }
        };
    });
};


module.exports = serve;
