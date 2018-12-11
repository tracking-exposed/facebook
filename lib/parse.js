var _ = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('lib:parse');
var moment = require('moment');
var nconf = require('nconf'); 

const xpath = require('xpath');
const xmldom = require('xmldom');
const JSDOM = require('jsdom').JSDOM;

var mongo = require('./mongo');
var sequence = require('../parsers/components/utils/sequence');

nconf.argv().env().file({ file: "config/collector.json" });

function initialize(impression) {
    
    if(_.isUndefined(impression.id))
        throw new Error("impression missing");

    return mongo
        .read(nconf.get('schema').metadata, { id: impression.id })
        .then(function(i) {
            if(i.id === impression.id) {
                /* todo: move as parameters ? */
                if(!nconf.get('repeat')) {
                    debug("metadata [%s] already exists, skipping", i.id);
                    return null;
                } else
                    debug("metadata [%s] exists, repeat is allowed", i.id);
            }

            const xmlerr = { warning: 0, error: 0, fatal: 0 };
            var domOptions = {
                  errorHandler:{
                      warning: function() { xmlerr.warning += 1; },
                      error: function() { xmlerr.error += 1; },
                      fatalError: function() { xmlerr.fatal += 1;  },
                  }
            };

            
            /* this is the envelope with get appended the metadata from the various parsers */
            return {
                impression,
                xmlerr,
                xpath,
                jsdom: new JSDOM(impression.html).window.document,
                dom: new xmldom.DOMParser(domOptions).parseFromString(impression.html),
            };
        });
}

function save(metadata) {
    /* this append and updated a metadata entry on the dedicated collection, the metadata.id === htmls.it */
    debug("Received %d metadata objects", _.size(metadata));
    if(_.size(metadata))
        return mongo
            .writeMany(nconf.get('schema').metadata, metadata);
} 

function mark(metadata) {
    /* this is the second function called, when the html is marked as processed,
     * probably the condition `false` should be considered worthy */

    debug("mark the htmls (%d) as processed", _.size(metadata));
    return Promise.map(metadata, function(e) {
        return mongo
            .read(nconf.get('schema').htmls, { id: e.id })
            .then(_.first)
            .then(function(existing) {

                if(existing.processed)
                    debug("p.s. been already processed %s", existing.id);

                existing.processed = true;
                return mongo
                    .updateOne(nconf.get('schema').htmls, { _id: existing._id }, existing);
            });
    }, { concurrency: 5});
}

function impression(input) {
    /* this is the first function call */

    debug("Initializing impression %s", input.id);
    return initialize(input)
        /* this is the sequence of parsers */
        .then(sequence)
        .then(function(results) {
            const removef = ['dom', 'jsdom', 'xpath', 'xmlerr', 'impression'];
            const impressionFields = ['id', 'timelineId', 'userId', 'impressionOrder', 'impressionTime'];

            let r = _.omit(results, removef);
            _.extend(r, _.pick(results.impression, impressionFields));

            /* log some stats about the success ratio, or compute the 
             * summary which would be saved later by 'save' */
            return r;
        })
        .catch(function(error) {
            debug("[E] %s", error.message);
            return null;
        });
};

module.exports = {
    impression: impression,
    save: save,
    mark: mark,
};
