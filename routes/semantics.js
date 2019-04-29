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

function redactEnriched(enrich) {
    _.unset(enrich, '_id');
    let s = _.first(enrich.summary);
    _.unset(s, '_id');
    _.unset(s, 'id');
    _.unset(s, 'user');
    _.unset(s, 'timeline');
    _.unset(s, 'impressionOrder');
    _.unset(s, 'impressionTime');
    enrich.summary = s;
    // XXX maybe can be redacted the condition of the ❌ below
    return enrich;
}

function enrich(req) {
    const DEFAULTAMOUNT = 13;
    const backintime = moment().subtract(2, 'd').toISOString();
    const { amount, skip } = params.optionParsing(req.params.paging, DEFAULTAMOUNT);
    debug("enrich request (lang: %s), amount %d skip %d",
        req.params.lang, amount, skip);

    if(!validLanguage(req.params.lang))
        return { json: LanguageError };

    return mongo
        .aggregate(nconf.get('schema').labels, [
            { $sort: { when: -1 }},
            { $match: { lang: req.params.lang, when: { "$lt": new Date(backintime) }} },
            { $skip: skip },
            { $limit: amount },
            { $lookup: { from: 'summary', localField: 'semanticId', foreignField: 'semanticId', as: 'summary' }}
        ])
        .map(redactEnriched)
        .then(function(enriched) {
            debug("return enrich, %d objects (%j)", _.size(enriched), _.map(enriched, function(e) {
                if(!e.summary || !e.summary.source || !e.summary.nature)
                    return "❌";
                return [ e.summary.source, e.summary.nature ];
            }));
            return { json: enriched };
        });
};

function noogle(req) {
    const DEFAULTAMOUNT = 13;
    const { amount, skip } = params.optionParsing(req.params.paging, DEFAULTAMOUNT);
    debug("noogle request (lang: %s, label: %s), amount %d skip %d",
        req.params.lang, req.params.label, amount, skip);

    if(!validLanguage(req.params.lang))
        return { json: LanguageError };

    return mongo
        .aggregate(nconf.get('schema').semantics, [
            { $sort: { when: -1 }},
            { $match: { lang: req.params.lang, label: req.params.label }},
            { $group: { _id: "$semanticId" }},
            { $skip: skip },
            { $limit: amount },
            { $lookup: { from: 'summary', localField: '_id', foreignField: 'semanticId', as: 'summary' }},
            { $lookup: { from: 'labels', localField: '_id', foreignField: 'semanticId', as: 'labels' }}
        ])
        .map(function(dirty) {
            let base = _.first(dirty.labels);
            base.summary = dirty.summary;
            base.when = moment(base.when);
            return base;
        })
        .map(redactEnriched)
        .then(function(results) {
            debug("return noogle, %d objects (%j)", _.size(results), _.map(results, function(e) {
                if(!e.summary || !e.summary.source || !e.summary.nature)
                    return "❌";
                return [ e.summary.source, e.summary.nature ];
            }));
            const ordered = _.orderBy(results, {when: -1 });
            return { json: results };
        });
};

function loud(req) { 
    const MAXENTRIES = 2000;
    const DEFAULTAMOUNT = 13;
    const backintime = moment().subtract(2, 'd').toISOString();
    const { amount, skip } = params.optionParsing(req.params.paging, DEFAULTAMOUNT);
    debug("loud request (lang: %s), amount %d skip %d",
        req.params.lang, amount, skip);

    if(!validLanguage(req.params.lang))
        return { json: LanguageError };

    return mongo
        .aggregate(nconf.get('schema').semantics, [
            { $match: { lang: req.params.lang, when: { "$lt": new Date(backintime) }} },
            { $limit: MAXENTRIES },
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


module.exports = {
    labels,
    semantics,
    enrich,
    loud,
    noogle
};
