var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('routes:samplerdebug');
var nconf = require('nconf');

var mongo = require('../lib/mongo');

function samplerdebug(req) {

    const sample = 10;

    if( _.get(req.params, 'key') !== nconf.get('password') ) {
        debug("Authentication failure, password mismatch");
        return { text: "key error" };
    }

    debug("Admin access: returning 6x%d most recent updates", sample);
    return Promise.all([
        mongo.readLimit(nconf.get('schema').impressions, {}, { impressionTime: -1 }, sample, 0),
        mongo.readLimit(nconf.get('schema').timelines, {}, { startTime: -1 }, sample, 0),
        mongo.readLimit(nconf.get('schema').metadata, {}, { impressionTime: -1 }, sample, 0),
        mongo.readLimit(nconf.get('schema').summary, {}, { impressionTime: -1 }, sample, 0),
        mongo.readLimit(nconf.get('schema').labels, {}, { when: -1 }, sample, 0),
        mongo.readLimit(nconf.get('schema').errors, {}, { when: -1 }, sample, 0),
    ])
    .then(function(x) {
        return {
            json: {
                impressions: x[0],
                timelines: x[1],
                metadata: x[2],
                summary: x[3],
                labels: x[4],
                errors: x[5],
            }
        };
    })
    .catch(function(error) {
        debug("Catch error: %s", error.message);
        return {
            json: { error: true, message: error.message }
        };
    });
};


module.exports = {
    samplerdebug: samplerdebug
}
