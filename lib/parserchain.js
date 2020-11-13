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

function wrapDissector(dissectorF, dissectorName, source, envelope) {
    try {
        // this function pointer point to all the functions in parsers/*
        // as argument they take function(source ({.jsdom, .html}, previous {...}))
        let retval = dissectorF(source, envelope.findings);
        let resultIndicator = JSON.stringify(retval).length;
        _.set(envelope.log, dissectorName, resultIndicator);
        return retval;
    } catch(error) {
        _.set(envelope.log, dissectorName, "!E");
        throw error;
    }
}

async function updateMetadataAndMarkHTML(e) {
    let r = await mongo3.upsertOne(mongodrivers.writec, nconf.get('schema').metadata, { id: e.id }, e);
    let u = await mongo3.updateOne(mongodrivers.writec, nconf.get('schema').htmls, { id: e.id }, { processed: true });
    return [ r.result.ok, u.result.ok ];
}

function buildMetadata(entry) {
    // this contains the original .source (html, impression, timeline), the .findings and .failures 
    const metadata = _.pick(entry.source.html, ['id', 'savingTime', 'timelineId']);
    metadata.impressionOrder = entry.source.impression.impressionOrder;
    metadata.semanticId ;
    debugger;
    return metadata;
}

module.exports = {
    initializeMongo,
    getLastHTMLs,
    wrapDissector,
    updateMetadataAndMarkHTML,
    buildMetadata,
};