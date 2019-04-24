var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('lib:CSV');
var nconf = require('nconf');

function produceCSVv1(entries) {

    const keys = [ "impressionTime", "impressionOrder","user",
        "timeline","publicationTime","postId","nature","fblinktype",
        "permaLink","source","sourceLink","displaySource","textSize",
        "LIKE","LOVE","ANGRY","HAHA","WOW","SAD","images.count","id" ];

    let produced = _.reduce(entries, function(memo, entry, cnt) {
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

    }, { init: false, csv: "" });
    return produced.csv;
};
 
module.exports = produceCSVv1;
