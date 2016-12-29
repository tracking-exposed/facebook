#!/usr/bin/env nodejs
var _ = require('lodash');
var cheerio = require('cheerio');
var moment = require('moment');
var debug = require('debug')('promotedInfo');
var parse = require('./lib/parse');

function tryPage(elem) {
    try {
        return elem.attr().onmouseover.replace(/.*\"http/, 'http').replace(/\".*/, '').replace(/\\/g, '');
    } catch(error) {
        return null;
    };
}
function getPromotedInfo(snippet) {

    var $ = cheerio.load(snippet.html);
    var ownerElem = $('.lfloat').attr();

    if(_.isUndefined(ownerElem)) {
        return { 'promotedInfo': false };
    }

    var href = ownerElem.href;
    /* this is also the least acceptable metadata amount of this 
     * parser */
    var retVal = {
        'ownerName': href,
        'promotedMedia': false,
        'promotedInfo': true
    };

    /* _.each( $('a'), function(e, i) { debug("%d %j ", i, e.attribs); }); */
    var externalOpen = $('[target=_blank]');
  
    if(externalOpen.length === 0) {
        // debug("elem has not a target _blank (%s)", snippet.id);
        /* TODO extract 
         *  promotedMedia = video (+promotedVideo)
         *  promotedMedia = gif (+promotedGif) 
         */
    }
    else {
        var promotedPage = tryPage(externalOpen);
        if(_.isNull(promotedPage)) {
            debug("target=_blank can't extract a link (%s)", snippet.id);
        } else {
            retVal.promotedMedia = 'page';
            retVal.promotedPage = promotedPage;
        }
    }

    debug("%s %s", snippet.id,
        retVal.promotedMedia === 'page' ? 'page' : '∅');
    return retVal;
};

return parse.please({
    'name': 'promotedInfo', /* this name is the same in parsers-key */
    'requirements': {'type': 'promoted'},
    'implementation': getPromotedInfo,
    'since': "2016-09-13",
    'until': moment().toISOString(),
});

