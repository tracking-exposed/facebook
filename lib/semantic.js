const _ = require('lodash');
const Promise = require('bluebird');
const debug = require('debug')('lib:semantic');
const nconf = require('nconf');
const request = Promise.promisifyAll(require('request'));

const mongo = require('../lib/mongo');

function getSemantic(value) {
    if(value !== true || value !== false)
        // This function by default looks for { semantic: true } 
        // { semantic: false } only in special cases, specify in function call
        value = true;

    return mongo
        .read(nconf.get('schema').metadata, { semantic: value });
}

function buildText(entry) {
    /* from [ { 'info': 'xx', 'text': 'ciao'}, {'info':'a', 'text': 'fregna' } ],
     * extend entry with .dandelion = { indexes, fulltext }
     * fulltext (as side effect of the _.each) 'ciao.\nfregna'
     * indexes = [ 0, 6 ]                                                      */

    let fulltext = "";
    let accumulator = 0;
    let indexes = [];

    _.each(entry.texts, function(to) {
        indexes.push(accumulator);
        fulltext += to.text + ".\n";
        accumulator = _.size(fulltext);
    });
    entry.dandelion = { fulltext, indexes };
    return entry;
};

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

function dandelion(token, textStruct, semanticId) {

    return request.postAsync(
        "https://api.dandelion.eu/datatxt/nex/v1/",
        { form: {
            token: token,
            'social.hashtag': true,
            text: textStruct.fulltext
        } })
        .then(function(results) {

            const body = JSON.parse(results.body);
            const headers = results.headers;

            if(_.isUndefined(body.lang)) {
                debug("semanticId %s len %d\tunable to extract semantic entities",
                    semanticId, _.size(textStruct.fulltext) );
                return {
                    lang: undefined,
                    headers: headers,
                };
            }

            if(!_.size(body.annotations)) {
                debug("semanticId %s len %d\tzero entities", semanticId, _.size(textStruct.fulltext));
                return {
                    lang: undefined,
                    headers: headers,
                };
            }

            /* this goes in the `labels` collection:
             * has a TTL (6 days)
             * reference the semanticId,
             * contains additional values to let the semanticId be selected (language, textlenght) */
            const label = {
                semanticId: semanticId,
                lang: body.lang,
                when: new Date(),
                l: _.map(body.annotations, 'label'),
                matchmap: textStruct.indexes,
                textsize: _.size(textStruct.fulltext)
            }

            /* this is keep to perform operation on single keywords, is a bridge between label and adopters/api,
             * label and semanticId are indexes */
            const semantics = _.map(body.annotations, function(a) {
                return {
                    semanticId: semanticId,
                    label: a.label,
                    lang: body.lang,
                    title: a.title,
                    spot: a.spot,
                    wp: a.uri,
                    confidence: _.round(a.confidence, 2),
                    when: new Date()
                };
            });

            debug("semanticId %s len %d\t%d chunks\tlang [%s/%d]\tlabels %d\tunits left %d",
                semanticId, _.size(textStruct.fulltext),
                _.size(textStruct.indexes), body.lang,
                _.round(body.langConfidence, 2),
                _.size(body.annotations), headers['x-dl-units-left'] );

            return {
                semantics: semantics,
                headers: headers,
                label: label,
                lang: body.lang,
            };
        })
        .catch(function(error) {
            debug("Dandelion retrieve & parse error in %s: %s", semanticId, error);
            return null;
        });
}

module.exports = {
    getSemantic: getSemantic,
    updateMetadata: updateMetadata,
    saveSemantic: saveSemantic,
    saveLabel: saveLabel,
    buildText: buildText,
    dandelion: dandelion,
};
