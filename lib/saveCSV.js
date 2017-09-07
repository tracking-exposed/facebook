var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('lib:saveCSV');
var nconf = require('nconf');
 
var mongo = require('./mongo');
var utils = require('./utils');

function saveCSV(query, type, amount, skip) {

    if(type === 'feed')
        var keys = [ 'savingTime', 'id', 'type', 'userId', 'impressionOrder',
                     'timelineId', 'publicationTime', 'postId', 'permaLink',
                     'hrefType', 'source', 'text', 'reason' ];
    else
        var keys = [ 'savingTime', 'id', 'type', 'userId', 'impressionOrder',
                     'timelineId', 'title',
                     'postLink', 'linkType', 'ownerName' ];

    return mongo
        .readLimit( nconf.get('schema').htmls, query, {}, amount, skip )
        .map(function(element) {
            return _.omit(element, ['html', '_id']);
        })
        .then(function(htmls) {
            var userId = htmls[0].userId;
            var oldest = htmls[0].savingTime;

            return mongo.read( nconf.get('schema').impressions, {
                userId: userId,
                impressionTime: { "$gt": new Date(moment(oldest).subtract(1, 'd').toISOString()) }
            })
            .reduce(function(memo, impression) {
                _.set(memo, impression.htmlId, impression.impressionOrder);
                return memo;
            }, {})
            .then(function(impdict) {
                return _.map(htmls, function(h) {
                    h.impressionOrder = impdict[h.id];
                    return h;
                });
            });
        })
        .tap(function(a) {
            debug("csv, reduction in progress (cap %d) %d entry", amount, _.size(a));
            if(_.size(a) === amount)
                debug("Limit reached!?");
        })
        .reduce(function(memo, entry) {
            if(!memo.init) {
                memo.csv += _.trim(JSON.stringify(keys), "][") + "\n";
                memo.init = true;
            }
            entry.savingTime = moment(entry.savingTime).toISOString();
            /* TODO check `memo.onlyValue` directive */
            _.each(keys, function(k, i) {
                var swap;
                if(k === 'publicationTime') {
                    swap = _.get(entry, 'publicationUTime');
                    swap = moment(swap * 1000).toISOString();
                } else {
                    swap = _.get(entry, k, "");
                    swap = _.replace(swap, /"/g, '〃');
                    swap = _.replace(swap, /'/g, '’');
                }
                memo.csv +=  '"' + swap + '"';
                if(!_.eq(i, _.size(keys) - 1))
                    memo.csv += ',';
            });
            memo.csv += "\n";
            return memo;

        }, { init: false, onlyValues: false, csv: "" })
        .then(function(blob) {
            return blob.csv;
        });
};

module.exports = saveCSV;
