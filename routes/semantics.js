const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');
const debug = require('debug')('routes:semantics');
const nconf = require('nconf');

const mongo = require('../lib/mongo');
const params = require('../lib/params');

const supported = [ "it", "pl", "en", "fr", "es", "pt", "ru", "he", "nl", "de", "et", "hr",
                    "ro", "uk", "fa", "fi", "hu", "no", "da", "ja", "lt", "id", "sv", "cs",
                    "lv", "ar", "af", "ko", "sk", "el", "th", "tr", "bn", "bg", "sl", "hi", "tl" ];

const LanguageError = {
    error: true,
    message: 'missing language',
    supported,
    reminder: 'the list of supported language comes from a mongodb.distinct call, should be updated'
};
function validLanguage(propl) {
    return (_.size(propl) == 2 || supported.indexOf(propl) !== -1);
}

function labels(req) {
    const { amount, skip } = params.optionParsing(req.params.paging, 100);
    debug("labels request (lang: %s), amount %d skip %d",
        req.params.lang, amount, skip);

    if(!validLanguage(req.params.lang))
        return { json: LanguageError };

    return mongo
        .readLimit(nconf.get('schema').labels, { lang: req.params.lang }, { when: -1 }, amount, skip)
        .then(function(data) {
            debug("retrived %d objects, with amount %d skip %d", _.size(data), amount, skip);
            return { json: data };
        })
        .catch(function(e) {
            debug("data (error): %s", e);
            return { 'text': `error: ${e}` };
        });
};

function semantics(req) {
    const { amount, skip } = params.optionParsing(req.params.paging, 100);
    debug("semantic request (lang: %s), amount %d skip %d",
        req.params.lang, amount, skip);

    if(!validLanguage(req.params.lang))
        return { json: LanguageError };

    return mongo
        .readLimit(nconf.get('schema').semantics, { lang: req.params.lang }, { when: -1 }, amount, skip)
        .then(function(data) {
            debug("retrived %d objects, with amount %d skip %d", _.size(data), amount, skip);
            return { json: data };
        })
        .catch(function(e) {
            debug("data (error): %s", e);
            return { 'text': `error: ${e}` };
        });
};

function enrich(req) { };

function loud(req) { 
    const { amount, skip } = params.optionParsing(req.params.paging, 13);
    debug("loud request (lang: %s), amount %d skip %d",
        req.params.lang, amount, skip);

    if(!validLanguage(req.params.lang))
        return { json: LanguageError };

    return mongo
        .aggregate(nconf.get('schema').semantics, [
            { $match: { lang: req.params.lang }},
            { $group: { _id: '$title', wp: { $first: '$wp'}, count: { $sum: 1 }}},
            { $sort: { "count": -1 }},
            { $skip: skip },
            { $limit: amount },
            { $project: { "label": "$_id", _id: false, wp: true, count: true }}
        ])
        .then(function(loudness) {
            debug("return loudness: %j", _.map(loudness, 'label'));
            return { json: loudness };
        });

};


function noogle(req) { };


module.exports = {
    labels,
    semantics,
    enrich,
    loud,
    noogle
};
