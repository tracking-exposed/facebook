const _ = require('lodash');
const debug = require('debug')('routes:rss');
const nconf = require('nconf');
 
const rss = require('../lib/rss');
const semantichain = require('../lib/semantichain');
const mongo = require('../lib/mongo');
const mongo3 = require('../lib/mongo3');
const utils = require('../lib/utils');

const DEFAULTMAXAMOUNT = 80;
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

    if(!(_.size(lang) == 2 && !_.isUndefined(_.get(semantichain.langMap, lang))))
        return { text: rss.produceError(null, null, "Language not found") };

    debug("feeds request (lang: %s, label: %s), max size %d",
        lang, label, amount);

        /* at first looks for cached entries, second try to build and save it, 
           cache is self expiring and inserted in lib/rss */
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


async function feedADS(req) {

    const lang = req.params.lang;
    const mongoc = await mongo3.clientConnect();
    const when = moment().subtract(1, 'h').format("YYYY-MM-DD HH");
    const id = utils.hash({ lang, 'ad': when });
    const cache = await mongo3.readOne(mongoc, ncpnf.get('schema').feeds, { id });
    const retval = {
        headers: { "Content-Type": "application/rss+xml" }
    };
    if(cache) {
        retval.text = cache.content;
    } else {
        const newcontent = await rss.composeADSfeed(id, lang, when);
        retval.text = newcontent.content;
    }
    await mongoc.close();
    debug("feedADS completed! %j", retval);
    return retval;
}

module.exports = {
    feedsAlgorithm0,
    feedADS,
};
