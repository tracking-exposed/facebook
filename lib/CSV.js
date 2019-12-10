var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('lib:CSV');

function produceCSVv1(entries) {
    const keys = [ "impressionTime", "impressionOrder","user",
        "timeline","publicationTime","postId","nature","fblinktype",
        "permaLink","source","sourceLink","displaySource","textSize",
        "LIKE","LOVE","ANGRY","HAHA","WOW","SAD","images.count","id" ];

    const text = internalCSV(entries, keys, false);
    debug("CSVv1 produced %d keys, from %d entries = %d bytes", _.size(keys), _.size(entries), _.size(text));
    return text;
}

function produceSimpleCSV(entries, firstLine) {
    const keys = [ "impressionTime", "postId", "name", "fullTextSize", 
                   "authorName", "authorDisplay", "timelineId", "id",
                   "nature", "attributions", "impressionOrder", "imgunmatch",
                   "imgprofiles", "imgview", "fblinktype" ];

    return internalCSV(entries, keys, !firstLine);
}

function internalCSV(entries, keys, printKeys) {
    /* when false, printKeys, add the first line */

    let produced = _.reduce(entries, function(memo, entry) {
        if(!memo.init) {
            memo.csv = _.trim(JSON.stringify(keys), '][') + "\n";
            memo.init = true;
        }

        _.each(keys, function(k, i) {
            let swap = _.get(entry, k, "");
            if(k == 'impressionTime' || k == 'publicationTime' )
                memo.csv += moment(swap).toISOString();
            else if(_.isInteger(swap))
                memo.csv += swap;
            else {
                swap = _.replace(swap, /"/g, '〃');
                swap = _.replace(swap, /'/g, '’');
                memo.csv +=  '"' + swap + '"';
            }
            if(!_.eq(i, _.size(keys) - 1))
                memo.csv += ',';
        });
        memo.csv += "\n";
        return memo;

    }, { init: printKeys, csv: "" });
    return produced.csv;
};

module.exports = {
    produceCSVv1,
    produceSimpleCSV,
}
