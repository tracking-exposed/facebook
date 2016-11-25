#!/usr/bin/env nodejs
var _ = require('lodash');
var cheerio = require('cheerio');
var moment = require('moment');
var debug = require('debug')('feedPostHref');
var parse = require('./lib/parse');

function getPostHref(snippet) {

    var $ = cheerio.load(snippet.html);
    var href = $('.timestampContent').parent().parent().attr().href;

    if(_.isUndefined(href)) {
        /* this might happen in "event" */
        debug("%s ∅", snippet.id);
        return { 'feedPostHref': false };
    }

    debug("%s\n  ≻  %s", snippet.id, href);
    return { 'feedPostHref': href };
};

var postHref = {
    'name': 'feedPostHref',
    'requirements': {'postType': 'feed'},
    'implementation': getPostHref,
    'since': "2016-09-13",
    'until': moment().toISOString(),
};

return parse.please(postHref);
