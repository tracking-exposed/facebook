#!/usr/bin/env nodejs
var _ = require('lodash');
var cheerio = require('cheerio');
var moment = require('moment');
var debug = require('debug')('parser:imageAltText');
var parse = require('./lib/parse');

/*
 * Extract alt text from img tags
 */

function imageAltText(snippet) {

    var $ = cheerio.load(snippet.html);

    var altTagFounds = $('img[alt]');
    altTagFounds = _.map(altTagFounds, function (e) {
      return e.attribs.alt;
    });
    debug("Found %j", altTagFounds);
    altTagFounds = _.flatten(altTagFounds);
    altTagFounds = _.reject(altTagFounds, "");
    altTagFounds = _.uniq(altTagFounds);

    debug("Found %j", altTagFounds);

    if(!_.size(altTagFounds)) {
        debug("Failed in %s", snippet.id);
        return { imageAltText: false };
    }
    else {
        debug("Found %j", altTagFounds);
        return {
            imageAltText: true,
            altTexts: altTagFounds
        };
    }
};

return parse.please({
    'name': 'imageAltText',
    'requirements': { hrefType: 'photo' },
    'implementation': imageAltText,
    'since': "2017-12-09",
    'until': moment().toISOString(),
});
