#!/usr/bin/env node
var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('parsers:components:promoted');

function promoted(envelop) {

    var timestamped = envelop.dom.getElementsByClassName('timestampContent');
    console.log(timestamped);
    console.log(timestamped.length);

    /*
    if($(".timestampContent").length > 0) {
        retO.type = 'feed';
        retO.promotedType = true;
        stats.feed += 1;
    } else if($('[href="/ads/about"]')) {
        retO.type = 'promoted';
        retO.promotedType = true;
        stats.promoted += 1;
    } else {
        retO.promotedType = false;
        stats.error += 1;
    }
*/
    debugger;
    envelop.promoted = { timestamped : _.size(timestamped) };
    return envelop;
};

/*
function hasLike($) {
    var mayLike = $(".UFILikeLink");
    // a number of entry for each like button present
    return (mayLike.length > 0 )
};

const sponsoredText = {
    'cs': 'Sponzorováno',
    'da': 'Sponsoreret',
    'de': 'Gesponsert',
    'en': 'Sponsored',
    'es': 'Publicidad',
    'fr': 'Sponsorisé',
    'hu': 'Hirdetés',
    'it': 'Sponsorizzata',
    'ja': '広告',
    'nb': 'Sponset',
    'nl': 'Gesponsord',
    'nn': 'Sponsa',
    'pl': 'Sponsorowane',
    'pt': 'Patrocinado',
    'ru': 'Реклама',
    'sk': 'Sponzorované',
    'sr': 'Спонзорисано',
    'sv': 'Sponsrad',
    'tr': 'Sponsorlu'
};

function promotedCheck($) {

    var as = $('a');
    
    var leafs = _.reduce(as, function(memo, chentr) { 
        if(_.size(chentr.children) === 1) {
            memo.push({
                cheerio: chentr,
                text: $(chentr).text()
            });
        }
        return memo;
    }, []);

    return _.reduce(sponsoredText, function(memo, label, lang) {
        _.each(leafs, function(l) {
            memo |= l.text === label;

            if(l.text === label)
                debug("Language used to detect sponsored content is", lang);
        });
        return memo;
    }, false);
};
*/

/*
var stats = { 'feed': 0, 'promoted': 0, 'error': 0 };

function getPostType(snippet) {

    var $ = cheerio.load(snippet.html);
    var retO = {};

    debug("%s %s [f %d p %d error %d]",
        snippet.id, retO.type, stats.feed,
        stats.promoted, stats.error);

    return retO;
};

var promotedType = {
    'name': 'promotedType',
    'requirements': { },
    'implementation': getPostType,
    'since': "2016-11-13",
    'until': moment().toISOString(),
};

return parse.please(promotedType);

*/

module.exports = promoted;
