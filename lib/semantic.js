const _ = require('lodash');
const Promise = require('bluebird');
const debug = require('debug')('lib:semantic');
const verbose = require('debug')('lib:semantic:v');
const nconf = require('nconf');
const request = Promise.promisifyAll(require('request'));

const mongo = require('../lib/mongo');

function getSemantic(value) {
    // This function by default looks for { semantic: true } 
    // true: means it is never been analyzed
    // null: zero entitites and/or language unsupported 
    // false: text too small (or other application conditions)
    // <ISODate>: when has been analyzed

    value = true; // XXX

    return mongo
        .read(nconf.get('schema').metadata, { semantic: value }, { impressionTime: -1});
}

function updateMetadata(updated) {
    return mongo
        .updateOne(nconf.get('schema').metadata, {
            _id: updated._id
        }, updated);
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

    const MINIMUM_SIZE = 140;
    if(_.size(fullText) < MINIMUM_SIZE) {
        debug("semanticId %s len %d\ttoo small, skipped", semanticId, _.size(fullText) );
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
        l: _.map(res.body.annotations, 'label'),
        textsize: _.size(res.fullText)
    }

    /* this is keep to perform operation on single keywords, is a bridge between label and adopters/api,
     * label and semanticId are indexes */
    const semantics = _.map(res.body.annotations, function(a) {
        return {
            semanticId: res.semanticId,
            label: a.label,
            lang: res.body.lang,
            title: a.title,
            spot: a.spot,
            wp: a.uri,
            confidence: _.round(a.confidence, 2),
            when: new Date()
        };
    });

    return {
        semantics: semantics,
        label: label,
        headers: res.headers,
        lang: res.body.lang,
        semanticId: res.semanticId
    }; // this goes back to bin/semanticsrv where the objects are saved
}

module.exports = {
    getSemantic: getSemantic,
    updateMetadata: updateMetadata,
    saveSemantic: saveSemantic,
    saveLabel: saveLabel,
    dandelion: dandelion,
    composeObjects: composeObjects,
};
