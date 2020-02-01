#!/usr/bin/env node
var _ = require('lodash');
var cheerio = require('cheerio');
var moment = require('moment');
var debug = require('debug')('parser:imageAltText');
var parse = require('./lib/parse');

function imageAltText(snippet) {

    var $ = cheerio.load(snippet.html);
    var altTagFounds = $('img[alt]');

    altTagFounds = _.map(altTagFounds, function (e) {
        try {
            if(e.parent.attribs['data-hovercard'])
                return null;
        } catch(c) { };
        try {
            if(e.parent.attribs.role)
                return null;
        } catch(c) { };

        return e.attribs.alt;
    });

    altTagFounds = _.flatten(altTagFounds);
    altTagFounds = _.reject(altTagFounds, "");
    altTagFounds = _.compact(altTagFounds);
    altTagFounds = _.uniq(altTagFounds);

    if(!_.size(altTagFounds)) {
        debug("Not found altText in %s", snippet.id);
        return { imageAltText: false };
    }

    if(_.size(altTagFounds) === 1)
        var altTexts = _.first(altTagFounds);
    else
        var altTexts = _.join(altTagFounds, ' ⁘ ');

    debug("Found %s [%s]: %s", snippet.id, snippet.hrefType, altTexts);
    return {
        imageAltText: true,
        altTexts: altTexts
    };
};

return parse.please({
    'name': 'imageAltText',
    'requirements': { type: 'feed' },
    'implementation': imageAltText,
    'since': "2017-12-09",
    'until': moment().toISOString(),
});
