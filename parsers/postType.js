#!/usr/bin/env nodejs
var _ = require('lodash');
var cheerio = require('cheerio');
var moment = require('moment');
var debug = require('debug')('parser:postType');
var parse = require('./lib/parse');

function hasLike($) {
    var mayLike = $(".UFILikeLink");
    /* a number of entry for each like button present */
    // debug("Likes spot %d", mayLike.length);
    return (mayLike.length > 0 )
};

function getPostType(snippet) {

    debug("→ %j", _.omit(snippet, ['html']));

    var $ = cheerio.load(snippet.html);
    var retO = {
        'postType': false
    }

    /* new theory: is missing the timeStampContent and the <abbr>, so
     * the binary decision can start from that */

    if(!hasLike($)) {
        debug("Nope ・%s ", snippet.id);
        return retO;
    }

    // debug("<abbr>: %d", $("abbr").length);
    if($(".timestampContent").length === 0) {
        debug("Promoted ・%s ", snippet.id);
        retO.type = 'promoted';
        retO.postType = true;
    } else {
        debug("Feed ・%s ", snippet.id);
        retO.type = 'feed';
        retO.postType = true;
    }
    return retO;
};

var postType = {
    'name': 'postType',
    'requirements': {},
    'implementation': getPostType,
    'since': "2016-11-13",
    'until': moment().toISOString(),
};

return parse.please(postType);
