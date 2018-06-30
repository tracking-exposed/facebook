var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:research');
var nconf = require('nconf');
var pug = require('pug');
 
var mongo = require('./mongo');
var tagId = require('./tagId');


function optionParse(inputs) {

    var start = _.get(inputs, 'start') || moment("2018-04-01");
    var end = _.get(inputs, 'end') || moment().format("YYYY-MM-DD");
    debug("optionParse: %j [start %s end %s]", inputs, start, end);

    return _.reduce(_.split(inputs.requestList,','), function(memo, tk) {

        var filter = {
            "nonfeed": { "$exists": false },
            startTime: {
                "$gt": new Date(moment(start)),
                "$lt": new Date(moment(end))
            }
        };

        if(_.startsWith(tk, 'l:'))
            memo.push(_.extend(filter, {
                tagId: tk.substring(2)
            }));

        if(_.startsWith(tk, 'u:')) {
            memo.push(_.extend(filter, {
                userId: _.parseInt(tk.substring(2))
            }));
        }
        return memo;

    }, []);
};

function mongoChain(filters) {
    return Promise
        .map(filters, tagId.getTimelines, { concurrency: 1})
        .then(_.flatten)
        .then(_.flatten)
        .then(function(results) {
            return {
                results: results,
                filters: filters
            };
        });
};


/* below the four `routes` are implemented */
function distinct(req) {

    if( "FbTREXadmin:youSHOULDnotUSEthis" === nconf.get('password') )
        return { text: "is configured the default key: forbidden" }

    if( req.params.authkey !== nconf.get('password') )
        return { text: "key error" };

    var tma = moment().subtract(3, 'months');
    debug("key OK: `ðistinct` on timelines.tagId, looking back to the 1st of %s", tma.format("MMM YYYY"));

    return mongo
        .distinct(nconf.get('schema').timelines, 'tagId',  {
            startTime: { '$gt': new Date(tma.format("YYYY-MM-01")) }
        })
        .then(function(tagIds) {
            return { json: tagIds};
        });
};

function rdata(req) {
    return mongoChain(optionParse(req.params))
        .then(function(y) {
            return { json: y /* results and filters are the keys */ };
        });
};

function rstats(req) {
    return mongoChain(optionParse(req.params))
        .then(computeStats)
        .then(function(counters) {
            return { json: counters };
        });
};

function computeStats(y) {
    return {
        userId: _.countBy(y.results, 'userId'),
        sourceId: _.countBy(y.results, 'sourceId'),
        impressionTime: _.countBy(y.results, function(e) {
            return moment(e.impressionTime).format("YYYY-MM-DD");
        }),
        hrefType:  _.countBy(y.results, 'hrefType'),
        postDiversity: _.countBy(_.countBy(y.results, 'postId')),
        filters: y.filters
    };
};

function researcher(req) {
    debug("researcher page accesses, requestList %s", req.params.requestList);
    return {
        text: pug.compileFile('sections/research/researcher.pug', {
            pretty: true,
            debug: false
        })()
    };
};

module.exports = {
    distinct: distinct,     /* API, :autkey as param, used by static page /distinct */
    rdata: rdata,           /* API, group data, :requestList as param */
    rstats: rstats,         /* API, group number, :requestList as param */
    researcher: researcher  /* static page to serve the .pug */
};
