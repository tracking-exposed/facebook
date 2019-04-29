const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');
const debug = require('debug')('routes:semantics');
const nconf = require('nconf');

const mongo = require('../lib/mongo');
const params = require('../lib/params');

const supported = [ "es", "en", "pt", "vi", "it", "sv", "pl", "hu", "bg", "de", "ro", "tl", "fr" ];
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
    debug("labels request, amount %d skip %d", amount, skip);

    if(!validLanguage(req.params.lang))
        return LanguageError;

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
    debug("semantic request, amount %d skip %d", amount, skip);

    if(!validLanguage(req.params.lang))
        return LanguageError;

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


module.exports = {
    labels,
    semantics,
};
