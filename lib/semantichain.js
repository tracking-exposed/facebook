const _ = require('lodash');
const debug = require('debug')('lib:semantichain');
const nconf = require('nconf');
const fetch = require('node-fetch');
const querystring = require('querystring');

const utils = require('./utils');
const mongo3 = require('./mongo3');

const MINIMUM_SIZE_WORTHY_TEXT = 18;
const MINIMUM_SIZE = 40;
let DANDELION_DISABLED = false;

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
    if(!findings.reformat)
        throw new Error("Lack of reformat");

    try {
        return await mongo3.insertMany(mongodrivers.writec, nconf.get('schema').semantics, findings.reformat.semantics);
    } catch(error) {
        debug("Error in writing semantic (%j): %s", _.size(findings.reformat.semantics), error);
        throw error;
    }
}

async function saveLabel(source, findings) {
    if(!findings.reformat)
        throw new Error("Lack of reformat");

    try {
        return await mongo3.writeOne(mongodrivers.writec, nconf.get('schema').labels, findings.reformat.label);
    } catch(error) {
        debug("Error in writing label (%j): %s", findings.reformat.label, error);
        throw error;
    }
}

async function dandelion(source, findings, config) {

    const fullText = source.texts.join('\n');

    if(_.size(fullText) < MINIMUM_SIZE) {
        /* debug("semanticId %s len %d\ttoo small (< %d): skipped",
            source.semanticId, _.size(fullText), MINIMUM_SIZE); */
        throw new Error("too small text " + _.size(fullText));
    }

    if(DANDELION_DISABLED)
        throw new Error("dandelion units exhausted"); // remind, tool hang

    /* documented in https://dandelion.eu/docs/api/datatxt/nex/ */
    const parameters = {
        token: config.token,
        text: fullText,
        "social.hashtag": true,
    };

    const response = await fetch("https://api.dandelion.eu/datatxt/nex/v1/?" + querystring.encode(parameters));
    const body = await response.json();
    if (response.status !== 200)
        throw Error(body.message)

    const headers = response.headers;

    if(body.lang && _.size(body.annotations) ) {
        debug("impression.id %s len %d\tlang [%s/%d]\tlabels %d\tunits left %d",
            source.id, _.size(fullText), body.lang,
            _.round(body.langConfidence, 2),
            _.size(body.annotations), _.parseInt(headers.get('x-dl-units-left') ));

        return { headers, body, fullText };
    }

    if(_.parseInt(headers.get('x-dl-units-left') === 0 )) {
        debug("Units finished!");
        DANDELION_DISABLED = true;
    }

    if(!body.lang) {
        debug("semanticId %s len %d\tunable to extract semantic entities",
            source.semanticId, _.size(fullText) );
        throw new Error("language not detected!");
    }

    if(!_.size(body.annotations)) {
        debug("semanticId %s len %d\tlang [%s/%d]\tzero entities\tunits left %d",
            source.semanticId, _.size(fullText), body.lang,
            _.round(body.langConfidence, 2), _.parseInt(headers.get('x-dl-units-left') ));
        throw new Error("Zero annotation found");
    }

    throw new Error("Unexpected condition!");
};

function reformat(source, findings) {

    if(!findings.dandelion)
        throw new Error("missing dandelion");

    const lang = _.get(findings, 'dandelion.body.lang');

    /* this goes in the `labels` collection:
     * has a TTL (6 days)
     * reference the semanticId,
     * contains additional values to let the semanticId be selected (language, textlenght) */
    const label = {
        semanticId: source.semanticId,
        lang: _.get(findings, 'dandelion.body.lang'),
        when: new Date(),
        l: _.map(_.get(findings, 'dandelion.body.annotations', []), function(anno) {
            return _.replace(anno.label, "'", "’");
        }),
        textsize: _.size(findings.dandelion.fullText)
    }

    /* this is keep to perform operation on single keywords, is a bridge between label and adopters/api,
     * label and semanticId are indexes */
    const semantics = _.map(_.get(findings, 'dandelion.body.annotations', []), function(a) {
        return {
            semanticId: source.semanticId,
            label: _.replace(a.label, "'", "’"),
            lang,
            title: _.replace(a.title, "'", "’"),
            spot: a.spot,
            wp: a.uri,
            confidence: _.round(a.confidence, 2),
            when: new Date()
        };
    });

    if(!lang || !_.size(semantics))
        throw new Error("Not produced meaningful content by dandelion!");

    debug("Produced one label and %d semantics entry (%s)", _.size(semantics), lang)
    return {
        semantics,
        label,
        lang
    };
}

async function wrapFunction(fcode, fname, envelope) {
    try {
        // this function pointer point to all the functions in parsers/*
        // as argument they take function(source ({.jsdom, .html}, previous {...}))

        let retval = await fcode(envelope.source, envelope.findings, envelope.settings);
        let resultIndicator = JSON.stringify(retval).length;
        _.set(envelope.log, fname, resultIndicator);
        return retval;
    } catch(error) {
        _.set(envelope.log, fname, "!E");
        throw error;
    }
}

async function markMetadata(e, update) {

    if(update.semantic == null) {
        debug("invalidating %s", e.source.id);
    }
    debugger;

    let u = await mongo3.updateOne(mongodrivers.writec, nconf.get('schema').metadata, { id: e.source.id }, { semantic: true });
    return _.get(u, 'result.ok', 'TODO investigate on error');
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

module.exports = {
    getSemantic,
    saveSemantic,
    saveLabel,
    dandelion,
    reformat,
    initializeMongo,
    wrapFunction,
    markMetadata,
    langMap,
};
