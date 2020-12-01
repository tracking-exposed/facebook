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
        'nature',
/*
        'data-ad-preview',
        'usertext',
        'commentable',
        'external',
        'opengraph',
        'event', */
    ],
    textChains: require('../parsers/textChains'),
    hrefChains: require('../parsers/hrefChains'),
    imageChains: require('../parsers/imageChains'),
    interactions: require('../parsers/interactions'),
    profiles: require('../parsers/profiles'),

    attributions: require('../parsers/attributions'),
    meaningfulId: require('../parsers/meaningfulId'),
    nature: require('../parsers/nature'),

    'data-ad-preview': require('../parsers/data-ad-preview'),
    usertext: require('../parsers/usertext'),
    commentable: require('../parsers/commentable'),
    external: require('../parsers/external'),
    event: require('../parsers/event'),
    // regexp: require('../parsers/regexp'),

    // functions
    initializeMongo,
    getLastHTMLs,
    wrapDissector,
    updateMetadataAndMarkHTML,
    buildMetadata,
};

const MINIMUM_SIZE_WORTHY_TEXT = 18;

function buildMetadata(entry) {
    // this contains the original .source (html, impression, timeline), the .findings and .failures 
    const metadata = _.pick(entry.source.html, ['id', 'timelineId']);
    metadata.savingTime = new Date(entry.source.html.savingTime);
    metadata.when = new Date();
    metadata.impressionOrder = entry.source.impression.impressionOrder;
    metadata.impressionTime = entry.source.impression.impressionTime;
    metadata.texts = _.filter(_.get(entry, 'findings.textChains.uniques', []), function(t) {
        return ( _.size(t) > MINIMUM_SIZE_WORTHY_TEXT );
    });
    metadata.semanticId = utils.hash({ t: JSON.stringify(metadata.texts) });
    metadata.images = _.map(_.get(entry, 'findings.imageChains.images', []), function(io) {
        return _.pick(io, ['linktype', 'src', 'height', 'width']);
    });
    metadata.hrefs = _.reduce(_.get(entry, 'findings.hrefChains.hrefs', []), function(memo, hi) {
        /* reduce because is a filter + map transformation */
        if(_.size(hi.text) === 0)
            return memo;
        memo.push(_.pick(hi, ['linktype', 'href', 'text']));
        return memo;
    }, []);
    metadata.meaningfulId = _.get(entry, 'findings.meaningfulId', []);
    metadata.complete = (_.reduce(metadata.meaningfulId, function(memo, e) { return (memo+(_.size(e)?1:0)) }, 0) > 1);
    metadata.publisherName = _.get(entry, 'findings.attributions.publisherName');
    metadata.geoip = _.get(entry, 'source.timeline.geoip');
    metadata.nature = entry.findings.nature;
    metadata.pseudo = entry.source.supporter.pseudo;
    metadata.paadc = _.get(entry, 'source.impression.paadc');
    metadata.userId = entry.source.supporter.userId;
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
            { $lookup: { from: 'timelines2', localField: 'timelineId', foreignField: 'id', as: 'timeline'} },
            { $lookup: { from: 'supporters2', localField: 'userId', foreignField: 'userId', as: 'supporter'} },
        ]);

    let errors = 0;
    const formatted = _.map(htmls, function(h) {
        try {
            return {
                timeline: _.first(h.timeline),
                impression: _.first(h.impression),
                supporter: _.first(h.supporter),
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