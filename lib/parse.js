const _ = require('lodash');
const Promise = require('bluebird');
const debug = require('debug')('lib:parse');
const moment = require('moment');
const nconf = require('nconf'); 
const xpath = require('xpath');
const xmldom = require('xmldom');
const JSDOM = require('jsdom').JSDOM;

const mongo = require('./mongo');
const sequence = require('../parsers/components/utils/sequence');
const echoes = require('./echoes');
const utils = require('./utils');

nconf.argv().env().file({ file: "config/collector.json" });

function initialize(impression, repeat) {
    
    if(_.isUndefined(impression.id))
        throw new Error("impression missing");

    return mongo
        .readOne(nconf.get('schema').metadata, { id: impression.id })
        .then(function(i) {

            if( _.get(i, 'id') === impression.id && !repeat) {
                debug("metadata [%s] already exists: skipping", i.id);
                return null;
            }

            if( _.get(i, 'id') === impression.id && repeat)
                debug("metadata [%s] exists, but repeat is requested", i.id);

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
    if(!_.size(metadata))
        return null;

    const onlyMetadata = _.map(metadata, function(e) {
        return _.omit(e, [ 'errors', 'summary']);
    });
    const errors = _.reduce(metadata, function(memo, e) {
        if(!_.size(e.errors))
            return memo;
        var r = {
            errors: e.errors,
            when:  new Date(),
            id: e.id,
            timelineId: e.timelineId
        }
        memo.push(r);
        return memo;
    }, []);

    const summary = _.map(metadata, function(e) {
        /* this do not includes Id because is an information we can eventually share
         * to the outside, and includes the correlation-counters computed in this lib */
        return _.extend(e.summary, _.pick(e, ['semanticId', 'postCounter', 'semanticCounter ']));
    });

    _.each(summary, function(e) {
        echoes.echo(
            _.extend({'index': 'parserv' },
            _.pick(e, ['errors', 'type', 'publicationTime', 'postId',
                       'permaLink', 'author', 'textlength', 'impressionTime',
                       'impressionOrder', 'pseudo', 'timeline' ])
            )
        );
    });

    let chain = [
        mongo.writeMany(nconf.get('schema').metadata, onlyMetadata),
        mongo.writeMany(nconf.get('schema').summary, summary)
    ];
    if(_.size(errors)) {
        chain.push(
            mongo.writeMany(nconf.get('schema').errors, errors)
        );
    }
    debug("Received %d metadata and %d errors", _.size(metadata), _.size(errors)
    );
    return Promise
        .all(chain)
        .return({
            metadata: _.size(metadata),
            errors: _.size(errors)
        });
}

function mark(metadata) {
    /* this is the second function called, when the html is marked as processed,
     * probably the condition `false` should be considered worthy */

    return Promise.map(metadata, function(e) {
        return mongo
            .readOne(nconf.get('schema').htmls, { id: e.id })
            .then(function(existing) {
                existing.processed = true;
                return mongo
                    .updateOne(nconf.get('schema').htmls, { _id: existing._id }, existing);
            });
    }, { concurrency: 1});
}

function postIdCount(e) {
    /* this function creates certain conditional fields in metadata:
     * * if there is no .linkedtime.postId, returns
     * - postCount { personal, global } gets created always */
    if(!e.linkedtime || !e.linkedtime.postId) {
        debug("postIdCount: postId is not present, wtf?: %j", e);
        return e;
    }

    e.postCount = { personal: null, global: null };

    return Promise.all([
        mongo.count(nconf.get('schema').metadata,
            { linkedtime: { postId: e.linkedtime.postId } }),
        mongo.count(nconf.get('schema').metadata,
            { linkedtime: { postId: e.linkedtime.postId }, userId: e.userId })
    ])
    .then(function(results) {
        e.postCount.global = results[0];
        e.postCount.personal = results[1];
        return e;
    }); 
};

function semanticIdCount(e) {
    /* this function creates certain conditional fields in metadata:
     * * if there is no .texts or zero-length texts, it returns
     * - semanticId gets created always
     * - semanticCount { personal, global } gets created always
     * - semantic: true, gets created when the semanticCount.global is zero  */
    if(!_.size(e.texts))
        return e;

    if(!( _.reduce(e.texts, function(memo, o) { return memo || !!_.size(o.text) }, false) )) {
        debug("check to be sure: the texts should be empty");
        debug("%s", JSON.stringify(e.texts));
        return e;
    }

    e.semanticId = utils.hashList(e.texts);
    e.semanticCount = { personal: null, global: null };

    return Promise.all([
        mongo.count(nconf.get('schema').metadata, { semanticId: e.semanticId }),
        mongo.count(nconf.get('schema').metadata, { semanticId: e.semanticId, userId: e.userId })
    ])
    .then(function(results) {
        e.semanticCount.global = results[0];
        e.semanticCount.personal = results[1];

        debug("computed semanticId: %s",
            JSON.stringify(e.semanticCount) );

        if(!e.semanticCount.global)
            e.semantic = true;

        return e;
    });
};

function parseHTML(htmlfilter, repeat) {
    return mongo
        .read(nconf.get('schema').htmls, htmlfilter)
        .map(function(html) {
            return mongo
                .readOne(nconf.get('schema').impressions, { id: html.impressionId })
                .then(function(impression) {
                    _.unset(impression, 'id');
                    _.unset(impression, 'htmlId');
                    return _.merge(html, impression);
                });
        }, { concurrency: 1 })
        .then(_.compact)
        .then(function(impressions) {
            return _.orderBy(impressions, { impressionOrder: -1 });
        })
        .tap(function(impressions) {
            if(_.size(impressions)) {
                const firstT = moment(_.first(impressions).impressionTime).format("DD/MMM HH:mm");
                const lastT = moment(_.last(impressions).impressionTime).format("DD/MMM HH:mm");
                debug("Found %d impressions associated: %d [%s] - %d [%s] (%s)",
                    _.size(impressions),
                    _.first(impressions).impressionOrder, firstT,
                    _.last(impressions).impressionOrder, lastT,
                    moment.duration(
                        moment(_.last(impressions).impressionTime) -
                        moment(_.first(impressions).impressionTime ))
                    .humanize()
                );
            }
        })
        .map(function(e) {
            return initialize(e, repeat);
        }, { concurrency: 1 })
        .then(_.compact)
        .map(sequence, { concurrency: 1 })
        /* this is the function processing the parsers
         * it is call of every .id which should be analyzed */
        .catch(function(error) {
            debug("[E] Unmanaged error in parser sequence: %s", error.message);
            console.log(error.stack);
            return null;
        })
        .map(function(results) {
            const removef = ['dom', 'jsdom', 'xpath', 'xmlerr', 'impression'];
            const impressionFields = ['id', 'timelineId', 'userId', 'impressionOrder', 'impressionTime'];

            /* here is composed the 'metadata' entry */
            let r = _.omit(results, removef);
            return _.extend(r, _.pick(results.impression, impressionFields));
        })
        .tap(function(metadata) {
            debug("⁂  completed %d metadata", _.size(metadata));
            if(!_.isUndefined(nconf.get('verbose')))
                debug("⁂  %s", JSON.stringify(metadata, undefined, 2));
        })
        .map(postIdCount)
        .map(semanticIdCount)
        .tap(mark)
        .then(save)
        .catch(function(error) {
            debug("[error after parsing] %s", error.message);
            console.log(error.stack);
            return null;
        });
}

module.exports = {
    initialize: initialize,
    save: save,
    postIdCount: postIdCount,
    semanticIdCount: semanticIdCount,
    mark: mark,
    parseHTML: parseHTML,
};
