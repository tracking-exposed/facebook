#!/usr/bin/env nodejs
var _ = require('lodash');
var cheerio = require('cheerio');
var moment = require('moment');
var debug = require('debug')('parser:feedUTime');
var parse = require('./lib/parse');

function getFeedUTime(snippet) {

    var $ = cheerio.load(snippet.html);
    var retO = {
        'feedUTime': false
    }

    var varstr = $(".timestampContent")[0].parent.attribs['data-utime'];
    var rv = _.parseInt(varstr);

    if(_.isNaN(rv)) {
        debug("Failure ・%s ", snippet.id);
    } else {
        debug("Extracted %s ・%s ", moment(rv * 1000), snippet.id);
        retO.feedUTime = true;
        retO.publicationUTime = rv;
    }

    return retO;
};

var feedUTime = {
    'name': 'feedUTime',
    'requirements': {'type': 'feed'},
    'implementation': getFeedUTime,
    'since': "2016-11-13",
    'until': moment().toISOString(),
};

return parse.please(feedUTime);
