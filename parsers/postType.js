var _ = require('lodash');
var cheerio = require('cheerio');
var moment = require('moment');
var debug = require('debug')('parser:postType');
var parse = require('./lib/parse');

function getPostType(snippet) {

    var $ = cheerio.load(snippet.html);

    if ($('.uiStreamSponsoredLink').length > 0) 
        var retVal = "promoted";
    else if ($('.uiStreamAdditionalLogging').length > 0)
        var retVal = "promoted";
    else
        var retVal = "feed";

    // TODO, don't use exclusion condition, but find a selector
    // for 'feed' too, and associate 'null' if nothing it is spot
    debug("・%s ∩ %s", snippet.id, retVal);
    return { 'postType': true, 
             'type': retVal };
};

var postType = {
    'name': 'postType',
    'requirements': {},
    'implementation': getPostType,
    'since': "2016-11-13",
    'until': moment().toISOString(),
};

return parse.please(postType);
