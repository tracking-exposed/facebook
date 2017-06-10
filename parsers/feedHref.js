#!/usr/bin/env nodejs
var _ = require('lodash');
var cheerio = require('cheerio');
var moment = require('moment');
var debug = require('debug')('parser:feedHref');
var parse = require('./lib/parse');

function getFeedHref(snippet) {

    var $ = cheerio.load(snippet.html);
    var retO = {
        'feedHref': false
    }

    var aelems = $("a");
    var urls = [];

    _.each(aelems, function(elem) {
        var dirtyhref = elem.attribs.href;
        if(_.startsWith(dirtyhref, "https://l.facebook.com")) {
            var exturl = unescape(dirtyhref.match(/u=(.*).h=/)[1]);
            urls.push(exturl);
        }
    });
    urls = _.uniq(urls);

    if(_.size(urls)) {
        debug("external url found in %s %d: %s",
            snippet.id, _.size(urls), urls);
        retO.feedHref = true;
        retO.externalHref = urls;
    } else
        debug(" ø %s", snippet.id);

    return retO;
};

var feedHref = {
    'name': 'feedHref',
    'requirements': {'type': 'feed'},
    'implementation': getFeedHref,
    'since': "2016-11-13",
    'until': moment().toISOString(),
};

return parse.please(feedHref);
