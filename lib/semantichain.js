const _ = require('lodash');
const debug = require('debug')('lib:semantichain');
const nconf = require('nconf'); 

const utils = require('./utils');
const mongo3 = require('./mongo3');


const mongodrivers = {
    readc: null,
    writec: null,
};

async function initializeMongo(amount) {
    mongodrivers.readc = await mongo3.clientConnect({concurrency: 1});
    mongodrivers.writec = await mongo3.clientConnect({concurrency: amount});
}

async function getSemantic(filter, max) {

    if(!mongodrivers.readc)
        await initializeMongo(max);

    debug(nconf.get('schema').metadata, { filter }, { impressionTime: 1 }, max, 0);

    const metadata = await mongo3.readLimit(
        mongodrivers.readc, nconf.get('schema').metadata,
        filter,
        { impressionTime: 1 },
        max, 0
    );

    return {
        overflow: _.size(metadata) == max,
        sources: metadata
    }
}

async function saveSemantic(source, findings) {
    debugger;
    if(!_.size(semantics))
        return null;

    try {
        return await mongo3.insertMany(mongodrivers.writec, nconf.get('schema').semantics, semantics);
    } catch(error) {
        debug("Error in writing semantic (%d): %s", _.size(semantics), error);
        return error;
    }
}

async function saveLabel(source, findings) {
    debugger;
    if(_.isUndefined(_.get(label, 'semanticId')))
        return null;

    try {
        return await mongo3.writeOne(mongodrivers.writec, nconf.get('schema').labels, label);
    } catch(error) {
        debug("Error in writing label (%s): %s", label.semanticId, error);
        return error;
    }
}

async function dandelion(source, findings, config) {

    const fullText = source.texts.join('\n');
    const MINIMUM_SIZE = 80;
    if(_.size(fullText) < MINIMUM_SIZE) {
        debug("semanticId %s len %d\ttoo small (< %d): skipped",
            source.semanticId, _.size(fullText), MINIMUM_SIZE);
        return null;
    }

    debugger;
    const results = await request.postAsync(
        "https://api.dandelion.eu/datatxt/nex/v1/",
        { form: {
            token: config.token,
            'social.hashtag': true,
            text: fullText
        } });
 
    debugger;
    const body = JSON.parse(results.body);
    const headers = results.headers;

    if(body.lang && _.size(body.annotations) ) {
        debug("semanticId %s len %d\tlang [%s/%d]\tlabels %d\tunits left %d",
            semanticId, _.size(fullText), body.lang,
            _.round(body.langConfidence, 2),
            _.size(body.annotations), headers['x-dl-units-left'] );

        return { body, headers, semanticId, fullText };
    }

    if(!body.lang)
        debug("semanticId %s len %d\tunable to extract semantic entities",
            semanticId, _.size(fullText) );
    else if(!_.size(body.annotations))
        debug("semanticId %s len %d\tlang [%s/%d]\tzero entities\tunits left %d",
            semanticId, _.size(fullText), body.lang,
            _.round(body.langConfidence, 2), headers['x-dl-units-left'] );

    debugger;
    return headers;
    // debug("Dandelion retrieve & parse error in %s: %s", semanticId, error);
};

function composeObjects(source, findings) {

    const res = findings.dandelion;
    debugger;
    /* the text might be too small or other failures */
    if(!res || !res.semanticId) return res;

    /* this goes in the `labels` collection:
     * has a TTL (6 days)
     * reference the semanticId,
     * contains additional values to let the semanticId be selected (language, textlenght) */
    const label = {
        semanticId: res.semanticId,
        lang: res.body.lang,
        when: new Date(),
        l: _.map(res.body.annotations, function(anno) {
            return _.replace(anno.label, "'", "’");
        }),
        textsize: _.size(res.fullText)
    }

    /* this is keep to perform operation on single keywords, is a bridge between label and adopters/api,
     * label and semanticId are indexes */
    const semantics = _.map(res.body.annotations, function(a) {
        return {
            semanticId: res.semanticId,
            label: _.replace(a.label, "'", "’"),
            lang: res.body.lang,
            title: _.replace(a.title, "'", "’"),
            spot: a.spot,
            wp: a.uri,
            confidence: _.round(a.confidence, 2),
            when: new Date()
        };
    });

    return {
        semantics,
        label,
        headers: res.headers,
        lang: res.body.lang,
        semanticId: res.semanticId
    }; // this goes back to bin/semanticsrv where the objects are saved
}

function dandelionCheck(source, findings) {

    debugger;
    if(analyzed && analyzed.headers && analyzed.headers['x-dl-units-left'] === 0) {
        debug("Units finished!");
        process.exit(1);
    }

    if(analyzed.skip)
        return semantic.updateMetadata(_.extend(entry, { semantic: false }) );

    if(!analyzed || !analyzed.semanticId || _.isUndefined(analyzed.lang))
        return semantic.updateMetadata(_.extend(entry, { semantic: null }) );

    return true;
}

const langMap = {
    'af': "Afrikaans",
    'ar': "Arabic",
    'bg': "Bulgarian",
    'bn': "Bengali",
    'cs': "Czech",
    'da': "Danish",
    'de': "German",
    'el': "Greek",
    'en': "English",
    'es': "Spanish",
    'et': "Estonian",
    'fa': "Persian",
    'fi': "Finnish",
    'fr': "French",
    'he': "Hebrew",
    'hi': "Hindi",
    'hr': "Croatian",
    'hu': "Hungarian",
    'id': "Indonesian",
    'it': "Italian",
    'ja': "Japanese",
    'ko': "Korean",
    'lt': "Lithuanian",
    'lv': "Latvian",
    'nl': "Dutch",
    'no': "Norwegian",
    'pl': "Polish",
    'pt': "Portuguese",
    'ro': "Romanian",
    'ru': "Russian",
    'sk': "Slovak",
    'sl': "Slovenian",
    'sv': "Swedish",
    'th': "Thai",
    'tl': "Tagalog",
    'tr': "Turkish",
    'uk': "Ukrainian",
};


const MINIMUM_SIZE_WORTHY_TEXT = 18;

function buildMetadata(source, findings) {

    debugger;
    // this contains the original .source (html, impression, timeline), the .findings and .failures 
    const metadata = _.pick(entry.source.html, ['id', 'timelineId']);
    metadata.savingTime = new Date(entry.source.html.savingTime);
    metadata.when = new Date();
    metadata.impressionOrder = entry.source.impression.impressionOrder;
    metadata.impressionTime = entry.source.impression.impressionTime;
    metadata.semanticId = utils.hash({ t: JSON.stringify(entry.findings.textChains.uniques) });
    metadata.texts = _.filter(entry.findings.textChains.uniques, function(t) {
        return ( _.size(t) > MINIMUM_SIZE_WORTHY_TEXT );
    });
    metadata.imageChains = entry.findings.imageChains;
    metadata.hrefChains = entry.findings.hrefChains;
    metadata.publisherName = entry.findings.attributions.publisherName;
    metadata.geoip = _.get(entry, 'source.timeline.geoip');
    metadata.nature = entry.findings.nature;
    metadata.userId = entry.source.supporter.userId;
    return metadata;
}

function wrapFunction(fcode, fname, envelope) {
    try {
        // this function pointer point to all the functions in parsers/*
        // as argument they take function(source ({.jsdom, .html}, previous {...}))
        let retval = fcode(envelope.source, envelope.findings, envelope.settings);
        let resultIndicator = JSON.stringify(retval).length;
        _.set(envelope.log, fname, resultIndicator);
        return retval;
    } catch(error) {
        _.set(envelope.log, fname, "!E");
        throw error;
    }
}

async function updateMetadataAndMarkHTML(e) {
    let r = await mongo3.upsertOne(mongodrivers.writec, nconf.get('schema').metadata, { id: e.id }, e);
    let u = await mongo3.updateOne(mongodrivers.writec, nconf.get('schema').htmls, { id: e.id }, { processed: true });
    return [ r.result.ok, u.result.ok ];
}


module.exports = {
    getSemantic: getSemantic,
    saveSemantic: saveSemantic,
    saveLabel: saveLabel,
    dandelion: dandelion,
    composeObjects,
    langMap,

    dandelionCheck,
    // functions
    initializeMongo,
    wrapFunction,
    updateMetadataAndMarkHTML,
    buildMetadata,
};