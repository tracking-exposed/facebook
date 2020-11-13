const _ = require('lodash');
const debug = require('debug')('lib:parserchain');
const nconf = require('nconf'); 
const JSDOM = require('jsdom').JSDOM;

const utils = require('./utils');
const mongo3 = require('./mongo3');

module.exports = {
    /* this sequence is executed in this order.
     * after the newline there are modules that levegared on previously mined metadata */
    dissectorList: [
        'textChains',
        'hrefChains',
        'imageChains',
        'interactions',
        'profiles',

        'attributions',
        'meaningfulId',
/*
        'data-ad-preview',
        'usertext',
        'video',
        'commentable',
        'external',
        'opengraph',
        'event', */
    ],
    textChains: require('../parsers/textchains'),
    hrefChains: require('../parsers/hrefchains'),
    imageChains: require('../parsers/imageChains'),
    interactions: require('../parsers/interactions'),
    profiles: require('../parsers/profiles'),

    attributions: require('../parsers/attributions'),
    meaningfulId: require('../parsers/meaningfulId'),

    'data-ad-preview': require('../parsers/data-ad-preview'),
    usertext: require('../parsers/usertext'),
    commentable: require('../parsers/commentable'),
    external: require('../parsers/external'),
    event: require('../parsers/event'),
    // regexp: require('../parsers/regexp'),
    video: require('../parsers/video'),

    // functions
    initializeMongo,
    getLastHTMLs,
    wrapDissector,
    updateMetadataAndMarkHTML,
    buildMetadata,
};

function buildMetadata(entry) {
    // this contains the original .source (html, impression, timeline), the .findings and .failures 
    const metadata = _.pick(entry.source.html, ['id', 'savingTime', 'timelineId']);
    metadata.impressionOrder = entry.source.impression.impressionOrder;
    metadata.semanticId = utils.hash({ t: JSON.stringify(entry.findings.textChains) });
    metadata.texts = _.map(entry.findings.textChains.uniques, function(t) {
        return ( _.size(t) > 15 );
    });
    metadata.hrefChains = entry.findings.hrefChains; 
    debugger;
    return metadata;
}

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