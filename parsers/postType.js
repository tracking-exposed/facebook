#!/usr/bin/env nodejs
var _ = require('lodash');
var cheerio = require('cheerio');
var moment = require('moment');
var debug = require('debug')('postType');
var parse = require('./lib/parse');

function getPostType(snippet) {

    var $ = cheerio.load(snippet.html);

    if ($('.uiStreamSponsoredLink').length > 0)
        var retVal = "promoted";
    else
        var retVal = "feed";

    debug("・%s ∩ %s", snippet.id, retVal);
    return retVal;
};

var postType = {
    'name': 'postType',
    'requirements': null,
    'implementation': getPostType,
    'since': "2016-11-13",
    'until': moment().toISOString(),
};

return parse.please(postType);
