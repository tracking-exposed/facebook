const _ = require('lodash');
const Promise = require('bluebird');
const debug = require('debug')('lib:semantic');
const verbose = require('debug')('lib:semantic:v');
const nconf = require('nconf');
const request = Promise.promisifyAll(require('request'));

const mongo = require('../lib/mongo');

function getSemantic(filter) {
    // This function by default looks for { semantic: true } 
    // true: means it is never been analyzed
    // null: zero entitites and/or language unsupported 
    // false: text too small (or other application conditions)
    // <ISODate>: when has been analyzed

    debug("Querying metadata by: %j", filter);
    return mongo
        .read(nconf.get('schema').metadata, filter, { impressionTime: -1});
}

function updateMetadata(updated) {
    /* here is an error: all the mentadata with the same semanticId should be
     * updated, otherwise, they might be reprocessed twice or more */
    return mongo
        .updateOne(nconf.get('schema').metadata, {
            _id: updated._id
        }, updated);
}

function doubleCheck(entry) {
    return mongo
        .count(nconf.get('schema').labels, { semanticId: entry.semanticId })
        .then(function(amount) {
            if(!amount) // amount can be 0 or 1, because semanticId is an unique id
                return entry;
            debug("DoubleCheck intervention on %s", entry.semanticId);
            return updateMetadata(_.extend(entry, { semantic: new Date() }) )
                .return(null);
        });
}

function saveSemantic(semantics) {
    if(!_.size(semantics))
        return null;

    return mongo
        .writeMany(nconf.get('schema').semantics, semantics)
        .catch(function(error) {
            debug("Error in writing semantic (%d): %s", _.size(semantics), error);
        });
}

function saveLabel(label) {
    if(_.isUndefined(_.get(label, 'semanticId')))
        return null;

    return mongo
        .writeOne(nconf.get('schema').labels, label)
        .catch(function(error) {
            debug("Error in writing label (%s): %s", label.semanticId, error);
        });
}

function dandelion(token, fullText, semanticId) {

    const MINIMUM_SIZE = 280;
    if(_.size(fullText) < MINIMUM_SIZE) {
        debug("semanticId %s len %d\ttoo small (< %d): skipped",
            semanticId, _.size(fullText), MINIMUM_SIZE);
        return Promise.resolve({ skip: true });
    }

    verbose("Building a POST request with %d bytes [%s]", _.size(fullText), fullText);
    return request.postAsync(
        "https://api.dandelion.eu/datatxt/nex/v1/",
        { form: {
            token: token,
            'social.hashtag': true,
            text: fullText
        } })
        .then(function(results) {
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

            return { headers };
        })
        .catch(function(error) {
            debug("Dandelion retrieve & parse error in %s: %s", semanticId, error);
            return null;
        });
};

function composeObjects(res) {

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
    getSemantic: getSemantic,
    updateMetadata: updateMetadata,
    saveSemantic: saveSemantic,
    saveLabel: saveLabel,
    dandelion: dandelion,
    doubleCheck: doubleCheck,
    composeObjects: composeObjects,
    langMap: langMap,
};
