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
const summarize = require('../parsers/components/utils/summarize');
const echoes = require('./echoes');
const utils = require('./utils');

function checkMetadata(impression, repeat) {
    if(_.isUndefined(impression.id))
        throw new Error("impression missing");

    return mongo
        .readOne(nconf.get('schema').metadata, { id: impression.id })
        .then(function(i) {
            if( _.get(i, 'id') === impression.id && !repeat) {
                debug("metadata [%s] already exists: skipping", i.id);
                return null;
            }

            if( _.get(i, 'id') === impression.id && repeat) {
                debug("metadata [%s] exists, but repeat is requested", i.id);
                return mongo
                    .remove(nconf.get('schema').metadata, { id: impression.id })
                    .return(impression);
            }

            /* else if _.isUndefined(i) is returned the impression */
            return impression;
        });
}

function initialize(impression) {
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
}

function finalize(metadata) {
    if(!_.size(metadata))
        return { metada: [], summary: [], errors: [] };

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

    const summary = _.map(metadata, summarize);

    return {
        metadata: _.map(metadata, function(e) {
            return _.omit(e, [ 'errors' ]);
        }),
        summary,
        errors
    };
}

function logSummary(blobs) {
    _.each(blobs.summary, function(e) {
        echoes.echo(
            _.extend({'index': 'parserv' },
            _.pick(e, ['errors', 'type', 'publicationTime', 'postId',
                       'permaLink', 'author', 'textlength', 'impressionTime',
                       'impressionOrder', 'pseudo', 'timeline', 'regexp' ])
            )
        );
    });
    if(nconf.get('fulldump'))
        _.each(blobs.metadata, function(o) {
            console.log(JSON.stringify(o, undefined, 2));
        });
}

function save(blobs) {
    let chain = [];
    debug("Received %d metadata and %d errors", _.size(blobs.metadata), _.size(blobs.errors));

    if(_.size(blobs.metadata)) {
        chain.push(
            mongo.writeMany(nconf.get('schema').metadata, blobs.metadata)  );
        chain.push(
            mongo.writeMany(nconf.get('schema').summary, blobs.summary)  );
    }

    if(_.size(blobs.errors))
        chain.push(
            mongo.writeMany(nconf.get('schema').errors, blobs.errors)  );

    return Promise
        .all(chain)
        .return({
            metadata: _.size(blobs.metadata),
            errors: _.size(blobs.errors)
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
     * * if there is no .linkedtime.postId, returns without 
     *   creating postCount
     * - postCount { personal, global } gets created always */
    if(!e.linkedtime || !e.linkedtime.postId) {
        debug("postIdCount: postId not present, the nature is [%s]", e.nature);
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
        if(!e.semanticCount.global)
            e.semantic = true;
        return e;
    });
};

function mergeHTMLImpression(html) {
    return mongo
        .readOne(nconf.get('schema').impressions, { id: html.impressionId })
        .then(function(impression) {
            _.unset(impression, 'id');
            _.unset(impression, 'htmlId');
            return _.merge(html, impression);
        });
}

function cleanFormat(results) {
    const removef = ['dom', 'jsdom', 'xpath', 'xmlerr', 'impression'];
    const impressionFields =
        ['id', 'timelineId', 'userId', 'impressionOrder', 'impressionTime'];
    /* here is composed the 'metadata' entry */
    let r = _.omit(results, removef);
    return _.extend(r, _.pick(results.impression, impressionFields));
};

function parseHTML(htmlfilter, repeat) {
    return mongo
        .read(nconf.get('schema').htmls, htmlfilter)
        .map(mergeHTMLImpression, { concurrency: 1 })
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
            return checkMetadata(e, repeat);
        }, { concurrency: 1 })
        .then(_.compact)
        .map(initialize)
        .map(sequence, { concurrency: 1 })
        /* this is the function processing the parsers
         * it is call of every .id which should be analyzed */
        .catch(function(error) {
            debug("[E] Unmanaged error in parser sequence: %s", error.message);
            console.log(error.stack);
            return null;
        })
        .map(cleanFormat)
        .tap(function(metadata) {
            debug("⁂  completed %d metadata", _.size(metadata));
            if(!_.isUndefined(nconf.get('verbose')))
                debug("⁂  %s", JSON.stringify(metadata, undefined, 2));
        })
        .map(postIdCount)
        .map(semanticIdCount)
        .tap(mark)
        .then(finalize)
        .tap(logSummary)
        .then(save)
        .catch(function(error) {
            debug("[error after parsing] %s", error.message);
            console.log(error.stack);
            return null;
        });
}

module.exports = {
    checkMetadata: checkMetadata,
    initialize: initialize,
    mergeHTMLImpression: mergeHTMLImpression,
    cleanFormat: cleanFormat,
    finalize: finalize,
    logSummary: logSummary,
    save: save,
    postIdCount: postIdCount,
    semanticIdCount: semanticIdCount,
    mark: mark,
    parseHTML: parseHTML,
};
