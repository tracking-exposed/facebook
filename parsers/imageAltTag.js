var _ = require('lodash');
var cheerio = require('cheerio');
var moment = require('moment');
var debug = require('debug')('parser:imageAltTag');
var parse = require('./lib/parse');

/*
 * Extract alt text from img tags
 */

var PARSER_COMPLETED_SUCCESSFULLY = false;

function implementation(snippet) {

    debug("→ %j", _.omit(snippet, ['html']));

    var $ = cheerio.load(snippet.html);

    var altTagFounds = $('img[alt]');
    altTagFounds = _.map(altTagFounds, function (e) {
      return e.attribs.alt;
    });
    altTagFounds = _.flatten(altTagFounds);
    altTagFounds = _.uniq(altTagFounds);

    PARSER_COMPLETED_SUCCESSFULLY = true;
    return {
        imageAltTag: PARSER_COMPLETED_SUCCESSFULLY,
        altTexts: altTagFounds
    }
};

return parse.please({
    'name': 'imageAltTag',
    'requirements': { hrefType: 'photo' },
    'implementation': implementation,
    'since': "2017-02-23",
    'until': moment().toISOString(),
});
