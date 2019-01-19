const _ = require('lodash');
const Promise = require('bluebird');
const debug = require('debug')('lib:semantic');
const nconf = require('nconf');
const request = Promise.promisifyAll(require('request'));

const mongo = require('../lib/mongo');

nconf.argv().env().file({ file: 'config/content.json' });

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

function saveLabels(labels) {
    if(!_.size(labels))
        return null;

    return mongo
        .writeMany(nconf.get('schema').labels, labels)
        .catch(function(error) {
            debug("Error in writing labels (%d): %s", _.size(labels), error);
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

            /* this goes in the `labels` collection, has a TTL, reference the semanticId */
            const labels = _.map(body.annotations, function(a) {
                return {
                    semanticId: semanticId,
                    label: a.label,
                    lang: body.lang,
                    when: new Date(),
                };
            });

            const semantics = _.map(body.annotations, function(a) {
                const blockn = _.last(_.first(_.partition(textStruct.indexes, function(i) {
                    return _.lte(i, a.start);
                })));
                return {
                    semanticId: semanticId,
                    blockn: textStruct.indexes.indexOf(blockn),
                    label: a.label,
                    wp: a.uri,
                };
            });

            debug("semanticId %s, fulltext %d (%d chunks) lang [%s/%d] annotations %d, units left %d",
                semanticId, _.size(textStruct.fulltext), _.size(textStruct.indexes), body.lang,
                body.langConfidence, _.size(body.annotations), headers['x-dl-units-left'] );

            return {
                semantics: semantics,
                headers: headers,
                labels: labels,
            }
        })
        .catch(function(error) {
            debug("Dandelion retrieve & parse %s: %s", semanticId, error);
            return null;
        });
}

module.exports = {
    getSemantic: getSemantic,
    updateMetadata: updateMetadata,
    saveSemantic: saveSemantic,
    saveLabels: saveLabels,
    buildText: buildText,
    dandelion: dandelion,
};
