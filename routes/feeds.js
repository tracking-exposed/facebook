const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');
const debug = require('debug')('routes:rss');
const nconf = require('nconf');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
 
const rss = require('../lib/rss');
const semantic = require('../lib/semantic');
const mongo = require('../lib/mongo');
const utils = require('../lib/utils');

const DEFAULTMAXAMOUNT = 20;
/*
 * logic:
 * compute a feedId using the hash function
 * check if the query exists in mongodb://facebook/feeds2
 *    if yes, retrieve the cached XML
 *    if not, 
 *       perform a query equivalent to the noogle
 *       generate the XML
 *       store the result in feeds2 (which has a TTL)
 */
function feedsAlgorithm0(req) {

    const lang = req.params.lang;
    const label = decodeURIComponent(req.params.query);
    const amount = req.params.amount ? _.parseInt(req.params.amount) : DEFAULTMAXAMOUNT;

    if(!(_.size(lang) == 2 && !_.isUndefined(_.get(semantic.langMap, lang))))
        return { text: rss.produceError(null, null, "Language not found") };

    debug("feeds request (lang: %s, label: %s), max size %d",
        lang, label, amount);

    return mongo
        .readOne(nconf.get('schema').feeds, { lang: lang, label: label })
        .then(function(f) {
            if(!f)
                return rss.composeRSSfeed(lang, label, amount);
            else
                return { text: f.content };
        })
        .then(function(textret) {
            return _.extend(textret, {
                headers: { "Content-Type": "application/rss+xml" }
            });
        });
};


module.exports = {
    feedsAlgorithm0,
};
