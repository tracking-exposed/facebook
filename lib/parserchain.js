const _ = require('lodash');
const debug = require('debug')('lib:parserchain');
const nconf = require('nconf'); 
const JSDOM = require('jsdom').JSDOM;

const mongo3 = require('./mongo3');

const mongodrivers = {
    readc: null,
    writec: null,
};

async function initializeMongo(amount) {
    mongodrivers.readc = await mongo3.clientConnect({concurrency: 1});
    mongodrivers.writec = await mongo3.clientConnect({concurrency: amount});
}

async function getLastHTMLs(filter, amount) {

    if(!mongodrivers.readc)
        await initializeMongo(amount);

    const htmls = await mongo3.aggregate(mongodrivers.readc,
        nconf.get('schema').htmls, [ 
            { $match: filter },
            { $sort: { "savingTime": 1 } },
            { $limit: amount },
            { $lookup: { from: 'impressions2', localField: 'impressionId', foreignField: 'id', as: 'impression'} },
            { $lookup: { from: 'timelines2', localField: 'timelineId', foreignField: 'id', as: 'timeline'} }
        ]);

    let errors = 0;
    const formatted = _.map(htmls, function(h) {
        try {
            return {
                timeline: _.first(h.timeline),
                impression: _.first(h.impression),
                jsdom: new JSDOM(h.html.replace(/\n\ +/g, '')).window.document,
                html: _.omit(h, ['timeline', 'impression' ])
            };
        }
        catch(error) {
            errors++;
            debug("Error when formatting HTML: %s, htmlId %s", error.message, h.id);
        }
    });

    return {
        overflow: _.size(htmls) == amount,
        sources: _.compact(formatted),
        errors,
    }
}

let logq = [];
function wrapDissector(dissfunc, dissname, e, previous) {
    try {
        // console.log("--", dissname, "html", _.size(e.html.html));
        let retval = dissfunc(e, previous);
        let resultIndicator = JSON.stringify(retval).length;
        logq.push({
            name: dissname,
            reslen: resultIndicator,
            metadata: retval,
        });
        return retval;
    } catch(error) {
        logq.push({
            name: dissname,
            error: error.message
        });
        throw error;
    }
}

function cleanLog() {
    logq = [];
}

function logMessage() {
    let m = _.map(logq, function(lo) {
        if(lo.error)
            return "<" + lo.name.substr(0,4) + " " +  lo.error.substr(0,10) + ">";
        else {
            return "[" + lo.name.substr(0,4) + " " +  lo.reslen + "]";
        }
    });
    // might be better and especially with a log of colors
    return m.join('|');
}

module.exports = {
    initializeMongo,
    getLastHTMLs,
    wrapDissector,
    cleanLog,
    logMessage,
};


/*
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
                return Promise.all([
                    mongo.remove(nconf.get('schema').metadata, { id: impression.id }),
                    mongo.remove(nconf.get('schema').summary, { id: impression.id })
                ])
                .return(impression);
            }

            // else if _.isUndefined(i) is returned the impression
            return impression;
        });
}

/* -- FUTURO, if xpath and xmldom are restored here 
   -- otherwise: no await/mongc here 

    const xpath = require('xpath');
    const xmldom = require('xmldom');
    const xmlerr = { warning: 0, error: 0, fatal: 0 };
    var domOptions = {
          errorHandler:{
              warning: function() { xmlerr.warning += 1; },
              error: function() { xmlerr.error += 1; },
              fatalError: function() { xmlerr.fatal += 1;  },
          }
    };
    return {
        impression,
        xmlerr,
        xpath,
        jsdom: new JSDOM(impression.html).window.document,
        dom: new xmldom.DOMParser(domOptions).parseFromString(impression.html),
    };

function initialize(impression) {
    // this is the envelope with get appended the metadata from the various parsers 
    return {
        impression,
        jsdom: new JSDOM(impression.html).window.document,
    };
}

function finalize(envelopes) {
    if(!_.size(envelopes))
        return { metadata: [], summary: [], statistics: [], parsers: [], errors: [] };

    /* here is build the new complex object which travels in the pipeline,
     * metadata & parsers are the internal content, not meant to be public 

    const errors = _.reduce(envelopes, function(memo, e) {
        if(!_.size(e.errors))
            return memo;
        var r = {
            errors: e.errors,
            when:  new Date(),
            id: e.impression.id,
            timelineId: e.impression.timelineId
        }
        memo.push(r);
        return memo;
    }, []);

    const removef = ['dom', 'jsdom', 'xpath', 'xmlerr', 'impression', 'errors'];
    const impressionFields =
        ['id', 'timelineId', 'userId', 'impressionOrder', 'impressionTime'];

    const metadata = _.map(envelopes, function(e) {
        return _.extend(
            _.pick(e.impression, impressionFields),
            _.omit(e, removef),
            { when: new Date() }
        );
    });
    const parsers = _.map(metadata, parserDebug);

    /* summary is the format used for user-facing API 
    const summary = _.map(metadata, summarize);
    /* statistics are the public information on how fbtrex is doing 
    const statistics = _.map(summary, aggregated.computeStats);

    return {
        metadata,
        parsers,
        summary,
        statistics,
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

    /* the `fulldump` is set by executers or by `parsers/precise.js`
    if(nconf.get('fulldump'))
        _.times(_.size(blobs.metadata), function(o, i) {
            let s = _.nth(blobs.summary, i);
            console.log(JSON.stringify(s, undefined, 1));
            console.log("\x1b[36m");
            let m = _.nth(blobs.metadata, i);
            console.log(JSON.stringify(m, undefined, 1));
        });

    /* this is dumped even without fulldump 
    const E = "\x1b[47m\x1b[31m";
    _.each(blobs.errors, function(o) {
        console.log(E, JSON.stringify(o, undefined, 2));
    });
}

function mark(blobs) {
    return Promise.map(blobs.metadata, function(e) {
        return mongo
            .readOne(nconf.get('schema').htmls, { id: e.id })
            .then(function(existing) {
                existing.processed = true;
                return mongo
                    .updateOne(nconf.get('schema').htmls, { _id: existing._id }, existing);
            });
    }, { concurrency: 1});
}

function save(blobs) {
    let chain = [];
    debug("Received %d metadata and %d errors", _.size(blobs.metadata), _.size(blobs.errors));

    if(_.size(blobs.metadata))
        chain.push(
            mongo.writeMany(nconf.get('schema').metadata, blobs.metadata)  );

    if(_.size(blobs.metadata) && !nconf.get('onlymetadata') ) {
        chain.push(
            mongo.writeMany(nconf.get('schema').summary, blobs.summary)  );
        chain.push(
            aggregated.updateHourly(blobs.statistics)   );
        /*
         - still unclear how and what we should records
        chain.push(
            mongo.writeMany(nconf.get('schema').parsers, blobs.parsers)   );
         
    }

    if(_.size(blobs.errors) && !nconf.get('onlymetadata') )
        chain.push(
            mongo.writeMany(nconf.get('schema').errors, blobs.errors)  );

    return Promise
        .all(chain)
        .return({
            metadata: _.size(blobs.metadata),
            errors: _.size(blobs.errors)
        })
        .catch(function(error) {
            console.log("error in saving:", error.message);
            return null;
        });
}

function postIdCount(e) {
    /* this function creates certain conditional fields in metadata:
     * - postId is build at the end of `sequence`
     * - postCount { personal, global } gets created always 

    // this is slowing too much the parsing, I'm going to removed it
    // --- sadClaudio

    if(!e.postId)
        return e;

    e.postCount = { personal: null, global: null };

    return Promise.all([
        mongo.count(nconf.get('schema').metadata,
            { linkedtime: { postId: e.postId } }),
        mongo.count(nconf.get('schema').metadata,
            { linkedtime: { postId: e.postId }, userId: e.userId })
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
     * - semantic: true, gets created when the semanticCount.global is zero  

    if(!e.fullTextSize)
        return e;

    e.semanticId = utils.hash({ text: e.fullText });
    e.semanticCount = { personal: null, global: null };

    return Promise.all([
        mongo.count(nconf.get('schema').metadata, { semanticId: e.semanticId }),
        mongo.count(nconf.get('schema').metadata, { semanticId: e.semanticId, userId: e.userId })
    ])
    .then(function(results) {
        e.semanticCount.global = results[0];
        e.semanticCount.personal = results[1];

        /* only the first metadata with a due semanticId is marked with `semantic`,
         * this will be processed later by lib/semantic.js 
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

/* FUTURO
async function parseHTML(htmlfilter, repeat) {

    if(!mongoc) {
        concur = _.isUndefined(nconf.get('concurrency') ) ? 5 : _.parseInt(nconf.get('concurrency') );
        debug("Initializing mongoDB connection with concurrency %d", concur);
        mongoc = await mongo.clientConnect({concurrency: concur });
    }

    const found = await mongo.read(mongoc, nconf.get('schema').htmls, htmlfilter);
    if(_.size(found) > 0)
        return found;

    if(!_.size(found)) {
        if(nconf.get('retrive') != true)
            return [];

        found = await glue.retrive(htmlfilter);
        await glue.writers(mongoc, found)
    }
} 

function parseHTML(htmlfilter, repeat) {
    return mongo
        .read(nconf.get('schema').htmls, htmlfilter)
        .then(function(found) {
            if(_.size(found) > 0)
                return found;
            if(nconf.get('retrive') != true) {
                debug("0 HTML found, and 'retrive' not configured!");
                return [];
            }
            return glue.retrive(htmlfilter)
                .then(glue.writers)
                .tap(function(x) {
                    if(x && x[2] && htmlfilter.id == x[2][0].id)
                        debug("Successfully retrived remote content");
                    else
                        debug("Failure in retriving remote content!");
                })
                .then(function() {
                    return mongo
                        .read(nconf.get('schema').htmls, htmlfilter);
                });
        })
        .catch(function(error) {
            debug("Managed error in retrieving content: %s", error);
            // console.error(error.stack);
            return [];
        })
        .map(mergeHTMLImpression, { concurrency: 1 })
        .then(_.compact)
        .then(function(impressions) {
            return _.orderBy(impressions, { impressionOrder: -1 });
        })
        .tap(function(impressions) {
            if(_.size(impressions)) {
                const firstT = moment(_.first(impressions).impressionTime).format("DD/MMM/YY HH:mm");
                const lastT = moment(_.last(impressions).impressionTime).format("DD/MMM/YY HH:mm");
                const humanized = moment
                    .duration( _.last(impressions).impressionTime - _.first(impressions).impressionTime )
                    .humanize();
                debug("Processing %d impressionOrder %s [%s] %s %s [%s] %s",
                    /*                                   ^^^^^^^^^^^^^ conditionals 
                    _.size(impressions),
                    _.first(impressions).impressionOrder, firstT,
                    _.size(impressions) > 1 ? "-" : "",
                    _.size(impressions) > 1 ? _.last(impressions).impressionOrder : "",
                    _.size(impressions) > 1 ? "[" + lastT + "]" : "",
                    _.size(impressions) > 1 ? "(" + humanized + ")" : ""
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
         * it is call of every .id which should be analyzed 
        .catch(function(error) {
            debug("[E] Unmanaged error in parser sequence: %s", error.message);
            console.log(error.stack);
            return null;
        })
        .then(function(metadata) {
            if(!metadata)
                return [];

            debug("⁂  completed %d metadata", _.size(metadata));
            if(!_.isUndefined(nconf.get('verbose')))
                debug("⁂  %s", JSON.stringify(metadata, undefined, 2));

            return metadata;
        })
        //.map(postIdCount)
        .map(semanticIdCount)
        .then(finalize)
        .tap(logSummary)
        .tap(mark)
        .then(save)
        .catch(function(error) {
            console.log("[error after parsing]", error.message);
            console.log(error.stack);
            return null;
        });
}

module.exports = {
    checkMetadata: checkMetadata,
    initialize: initialize,
    mergeHTMLImpression: mergeHTMLImpression,
    finalize: finalize,
    logSummary: logSummary,
    save: save,
    postIdCount: postIdCount,
    semanticIdCount: semanticIdCount,
    mark: mark,
    parseHTML: parseHTML,
};


#!/usr/bin/env node
const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('yttrex:parserv');
const debuge = require('debug')('yttrex:parserv:error');
const overflowReport = require('debug')('yttrex:OVERFLOW');
const nconf = require('nconf');
const JSDOM = require('jsdom').JSDOM;
const fs = require('fs');

const videoparser = require('../parsers/video');
const longlabel = require('../parsers/longlabel');
const homeparser = require('../parsers/home');
const automo = require('../lib/automo');
const utils = require('../lib/utils');

nconf.argv().env().file({ file: 'config/settings.json' });


const FREQUENCY = 10;
const AMOUNT_DEFAULT = 20;
const BACKINTIMEDEFAULT = 3;

let skipCount = _.parseInt(nconf.get('skip')) ? _.parseInt(nconf.get('skip')) : 0;
let htmlAmount = _.parseInt(nconf.get('amount')) ? _.parseInt(nconf.get('amount')) : AMOUNT_DEFAULT;

const stop = _.parseInt(nconf.get('stop')) ? (_.parseInt(nconf.get('stop')) + skipCount): 0;
const backInTime = _.parseInt(nconf.get('minutesago')) ? _.parseInt(nconf.get('minutesago')) : BACKINTIMEDEFAULT;
const id = nconf.get('id');
const filter = nconf.get('filter') ? JSON.parse(fs.readFileSync(nconf.get('filter'))) : null;
const singleUse = !!id;
const repeat = !!nconf.get('repeat');

let nodatacounter = 0;
let processedCounter = skipCount;
let lastExecution = moment().subtract(backInTime, 'minutes').toISOString();
let computedFrequency = 10;
const stats = { lastamount: null, currentamount: null, last: null, current: null };
let lastErrorAmount = 0;

if(backInTime != BACKINTIMEDEFAULT) {
    const humanized = moment.duration(
        moment().subtract(backInTime, 'minutes') - moment()
    ).humanize();
    debug(`Considering ${backInTime} minutes (${humanized}), as override the standard ${BACKINTIMEDEFAULT} minutes ${lastExecution}`);
}

const advSelectors = {
    ".ytp-title-channel": videoparser.adTitleChannel,
    ".video-ads.ytp-ad-module": videoparser.videoAd,
    ".ytp-ad-player-overlay-instream-info": videoparser.overlay,
    ".ytp-chrome-top": videoparser.videoTitleTop,
    ".ytp-title-text": videoparser.videoTitleTop,
};

async function newLoop(htmlFilter) {
    /* this is the begin of the parsing core pipeline.
     * gets htmls from the db, if --repeat 1 then previously-analyzed-HTMLS would be
     * re-analyzed. otherwise, the default, is to skip those and wait for new 
     * htmls. To receive htmls you should have a producer consistend with the 
     * browser extension format, and bin/server listening 
     * 
     * This script pipeline might optionally start from the past, and 
     * re-analyze HTMLs based on --minutesago <number> option.
     * 
     * At the end update metadata only if meaningful update is present,
     * you might notice the library calls in automo, they should be refactored
     * and optimized.

    const htmls = await automo.getLastHTMLs(htmlFilter, skipCount, htmlAmount);
    if(!_.size(htmls.content)) {

        nodatacounter++;
        if( (nodatacounter % 10) == 1) {
            debug("%d no data at the last query: %j %j",
                nodatacounter, _.keys(htmlFilter), htmlFilter.savingTime);
        }
        lastExecution = moment().subtract(2, 'm').toISOString();
        computedFrequency = FREQUENCY;
        return;
    } else {
        computedFrequency = 0.1;
    }

    if(!htmls.overflow) {
        lastExecution = moment().subtract(BACKINTIMEDEFAULT, 'm').toISOString();
        /* 1 minute is the average stop, so it comeback to check 3 minutes before 
        overflowReport("<NOT>\t\t%d documents", _.size(htmls.content));
    }
    else {
        lastExecution = moment(_.last(htmls.content).savingTime);
        overflowReport("first %s (on %d) <last +minutes %d> next filter set to %s",
            _.first(htmls.content).savingTime, _.size(htmls.content),
            _.round(moment.duration(
                moment(_.last(htmls.content).savingTime ) - moment(_.first(htmls.content).savingTime )
            ).asMinutes(), 1),
            lastExecution);
    }

    if(stats.currentamount || stats.lastamount)
        debug("[+] %d start a new cicle, %d took: %s and now process %d htmls",
            processedCounter,
            stats.currentamount, moment.duration(moment() - stats.current).humanize(),
            _.size(htmls.content));
    stats.last = stats.current;
    stats.current = moment();
    stats.lastamount = stats.currentamount;
    stats.currentamount = _.size(htmls.content);

    const analysis = _.map(htmls.content, processEachHTML);
    /* analysis is a list with [ impression, metadata ] 

    const updates = [];
    for (const entry of _.compact(analysis)) {
        let r = await automo.updateMetadata(entry[0], entry[1], repeat);
        updates.push(r);
    }
    debug("%d html.content, %d analysis, compacted %d, effects: %j",
        _.size(htmls.content), _.size(analysis),
        _.size(_.compact(analysis)), _.countBy(updates, 'what'));

    /* reset no-data-counter if data has been sucessfully processed 
    if(_.size(_.compact(analysis)))
        nodatacounter = 0;

    /* also the HTML cutted off the pipeline, the many skipped
     * by _.compact all the null in the lists, should be marked as processed 
    const remaining = _.reduce(_.compact(analysis), function(memo, blob) {
        return _.reject(memo, { id: blob[0].id });
    }, htmls.content);

    debug("Usable HTMLs %d/%d - marking as processed the useless %d HTMLs\t\t(sleep %d)",
        _.size(_.compact(analysis)), _.size(htmls.content), _.size(remaining), computedFrequency);

    const rv = await automo.markHTMLsUnprocessable(remaining);
    debug("%d completed, took %d secs = %d mins",
        processedCounter, moment.duration(moment() - stats.current).asSeconds(),
        _.round(moment.duration(moment() - stats.current).asMinutes(), 2));
    return rv;
}

async function markHTMLsUnprocessable(htmls) {
    const mongoc = await mongo3.clientConnect({concurrency: 1});
    const ids = _.map(htmls, 'id');
    const r = await mongo3.updateMany(mongoc, nconf.get('schema').htmls,
        { id: { $in: ids }}, { processed: false });

    if( r.result.n != _.size(ids) || r.result.nModified != _.size(ids) || r.result.ok != 1) {
        debug("partial update happened! (it should be ok) %j", r.result);
    } 
    await mongoc.close();
    return r;
}

async function updateMetadata(html, newsection, repeat) {

    async function markHTMLandClose(mongoc, html, retval) {
        await mongo3.updateOne(mongoc, nconf.get('schema').htmls, { id: html.id }, { processed: true });
        await mongoc.close();
        return retval;
    }

    // we should look at the same metadataId in the metadata collection,
    // and update new information if missing 
    const mongoc = await mongo3.clientConnect({concurrency: 1});

    if(!html.metadataId) {
        debug("metadataId is not an ID!");
        return await markHTMLandClose(mongoc, html, { what: 'not an ID'});
    }

    const exists = await mongo3.readOne(mongoc, nconf.get('schema').metadata, { id: html.metadataId });

    if(!exists) {
        await createMetadataEntry(mongoc, html, newsection);
        debug("Created metadata %s [%s] from %s with %s",
            html.metadataId, 
            (newsection.title ? newsection.title : "+" + newsection.type + "+"),
            html.href, html.selector);
        return await markHTMLandClose(mongoc, html, { what: 'created'});
    }

    let updates = 0;
    let forceu = repeat;
    const newkeys = [];
    const updatedkeys = [];

    const careless = [ 'clientTime', 'savingTime' ];
    const up = _.reduce(newsection, function(memo, value, key) {

        if(_.isUndefined(value)) {
            debug("updateChecker: <%s> has undefined value!", key);
            return memo;
        }
        if(_.indexOf(careless, key) !== -1)
            return memo;

        let current = _.get(memo, key);
        if(!current) {
            _.set(memo, key, value);
            newkeys.push(key);
            updates++;
        } else if(utils.judgeIncrement(key, current, value)) {
            _.set(memo, key, value);
            updatedkeys.push(key);
            forceu = true;
            updates++;
        }
        return memo;
    }, exists);

    if(updates)
        debug("Metadata UPDATE: %s (%s) %d -> new %j, overwritten: %j",
            html.metadataId, html.selector, updates, newkeys, updatedkeys);

    if(forceu || updates ) {
        // debug("Update from incremental %d to %d", exists.incremental, up.incremental);
        // not in youtube!
        let r = await mongo3.updateOne(mongoc, nconf.get('schema').metadata, { id: html.metadataId }, up );
        return await markHTMLandClose(mongoc, html, { what: 'updated'});
    }
    return await markHTMLandClose(mongoc, html, { what: 'duplicated'});
}

async function createMetadataEntry(mongoc, html, newsection) {
    let exists = _.pick(html, ['publicKey', 'savingTime', 'clientTime', 'href' ]) ;
    exists = _.extend(exists, newsection);
    exists.id = html.metadataId;
    await mongo3.writeOne(mongoc, nconf.get('schema').metadata, exists);
    return exists;
}
*/