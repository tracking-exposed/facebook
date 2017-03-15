var _ = require('lodash');
var cheerio = require('cheerio');
var moment = require('moment');
var debug = require('debug')('parser:imageAltTag');
var parse = require('./lib/parse');

/*
 * Extract alt text from img tags
 */

var PARSER_COMPLETED_SUCCESSFULLY = false;
var FACEBOOK_ALT_TEXT_START = 'Image may contain:';

function parseAltContent(altText) {
    var content = altText.split(FACEBOOK_ALT_TEXT_START)[1];
    var parsedWords = content.split(',');
    parsedWords = _.map(parsedWords, function (e) { return e.trim() });
    return parsedWords;
}

function implementation(snippet) {

    debug("→ %j", _.omit(snippet, ['html']));

    var $ = cheerio.load(snippet.html);
    var returnValue = [];

    var altTagFounds = $('img[alt^="'+FACEBOOK_ALT_TEXT_START+'"]');

    _.each(altTagFounds, function (e) {
        returnValue.push(parseAltContent(e.attribs.alt));
    })
    returnValue = _.flatten(returnValue);

    PARSER_COMPLETED_SUCCESSFULLY = true;
    return {
        'imageAltTag': returnValue
    }
};

return parse.please({
    'name': 'imageAltTag',
    'requirements': { hrefType: 'photo' },
    'implementation': PARSER_COMPLETED_SUCCESSFULLY,
    'since': "2017-02-23",
    'until': moment().toISOString(),
});
