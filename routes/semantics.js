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

    return loudKeywordsPipeline(MAXENTRIES, backintime, amount, skip, req.params.lang)
        .then(function(loudness) {
            debug("return loudness: %j", _.map(loudness, 'label'));
            return { json: loudness };
        });

};

function loudKeywordsPipeline(maxentries, backintime, amount, skip, lang) {
    return mongo
        .aggregate(nconf.get('schema').semantics, [
            { $match: { lang: lang, when: { "$lt": new Date(backintime) }} },
            { $limit: maxentries },
            { $group: { _id: '$title', wp: { $first: '$wp'}, count: { $sum: 1 }}},
            { $sort: { "count": -1 }},
            { $skip: skip },
            { $limit: amount },
            { $project: { "label": "$_id", _id: false, wp: true, count: true }}
        ]);
}

const cache = _.reduce(supported, function(memo, l) {
    _.set(memo, l, {
        content: null,
        computedAt: null,
        next: null,
    });
    return memo;
}, {} );

function formatReturn(lang, updated) {
    if(updated) {
        cache[lang].content = updated.content;
        cache[lang].computedAt = updated.computedAt;
        cache[lang].next = updated.next
    }
    return {
        json: {
            content: cache[lang].content,
            computedt: cache[lang].computedAt.toISOString(),
            next: cache[lang].next.toISOString(),
        }
    };
};


function langinfo(req) {
    /* this API returns an complete information on a language population, with number of 
     * active contributors in the last 48 hours and total keyword seen in the last 48 hours,
     * this API do not support paging and is meant to be cached */
    const MAXENTRIES = 60000;
    const DEFAULTAMOUNT = 10;
    const hoursNumber = 48;
    const backintime = moment().subtract(hoursNumber, 'h').toISOString();
    const amount = 13;
    const skip = 0;
    const lang = req.params.lang;
    const cacheMinutes = 60 * 2;

    if(!validLanguage(lang))
        return { json: LanguageError };

    if(cache[lang].next && moment().isBefore(cache[lang].next) && cache[lang].content) {
        debug("langInfo %s, using cached version", lang);
        return formatReturn(lang);
    }

    debug("langInfo %s, retrieving from DB", lang);
    return Promise.all([
        loudKeywordsPipeline(MAXENTRIES, backintime, amount, skip, lang),
        mongo.aggregate(nconf.get('schema').semantics, [
            { $sort: { when: -1 }},
            { $match: { lang: req.params.lang, when: { "$gt": new Date(backintime) } }},
            { $limit: MAXENTRIES },
            { $group: { _id: "$label" }},
            { $group: { _id: null, amount: { "$sum": 1 } }},
        ]).then(function(o) { return (o && o[0] && o[0].amount) ? obj[0].amount : 0 }),
        mongo.aggregate(nconf.get('schema').labels, [
            { $sort: { when: -1 }},
            { $match: { lang: lang, when: { "$gt": new Date(backintime) } }},
            { $limit: MAXENTRIES },
            { $lookup: { from: 'summary', localField: 'semanticId', foreignField: 'semanticId', as: 'summary' }},
            { $group: { _id: "dummy", profiles: { $addToSet: "$summary.user"} }}
        ]).then(function(usermess) {
            // remind/TODO grouped by size and anonymized, this can be a nice stats
            // _.flatten(usermess[0].profiles)
            if(!(usermess && usermess[0] && usermess[0].profiles))
                return 0;
            return _.size(_.uniq(_.flatten(usermess[0].profiles)))
        })
    ])
    .then(function(results) {
        let retval = {
            consideredHoursWindow: hoursNumber,
            language: req.params.lang,
            most: _.map(results[0], 'label'),
            labelsCount: results[1],
            contributors: results[2],
        };
        return formatReturn(lang, {
            content: retval,
            computedAt: moment(),
            next: moment().add(cacheMinutes, 'minutes')
        });
    });
}

module.exports = {
    labels,
    semantics,
    enrich,
    loud,
    noogle,
    langinfo
};
