var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:research');
var nconf = require('nconf');
var pug = require('pug');
 
var various = require('./various');
var utils = require('./utils');
var mongo = require('./mongo');
var tagId = require('./tagId');


function optionParse(inputs) {

    var end = _.get(inputs, 'end') || moment().format("YYYY-MM-DD");
    var start = moment("2018-04-01").format("YYYY-MM-DD");

    if(_.get(inputs, 'start'))
        start = moment(_.get(inputs, 'start')).format("YYYY-MM-DD");
    if(_.get(inputs, 'end'))
        end = moment(_.get(inputs, 'end')).format("YYYY-MM-DD");

    debug("optionParse: %s [start %s end %s]", inputs.requestList, start, end);

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

/** -- new api designed: research in progress, August 2018 -- **/
function qualitativeOverview(req) {
    var rname = req.params.rname ? req.params.rname : null;

    debug("qualitativeOverview for %s", req.params.rname);
    return various
        .loadJSONfile("config/researches.json")
        .then(function(researches) {
            return _.get(researches, req.params.rname);
        })
        .then(function(rsettings) {
            if(!rsettings && !_.isString(rsettings.collection)) {
                debuf("Invalid research name requested");
                return { text: "Invalid research name" };
            }

            return Promise.all([
                mongo.countByDay(rsettings.collection, '$publicationTime', { evaluated: true}),
                mongo.countByDay(rsettings.collection, '$publicationTime', { evaluated: false})
            ]);
        })
        .map(function(stat, i) {
            return _.map(stat, function(s) {
                _.set(s._id, 'month', _.get(s._id, 'month') - 1);
                /* the month from mongo is ok, but moment want since January = 0 
                 > moment({ year: 2018, month: 5, day: 31 }).format("YYYY-MM-DD")
                 'Invalid date'
                 > moment({ year: 2018, month: 5, day: 30 }).format("YYYY-MM-DD")
                 '2018-06-30'
                       ^^
                 */
                return {
                    day: moment(s._id).format("YYYY-MM-DD"),
                    count: s.count
                };
            });
        })
        .then(function(results) {

            var days = _.map(_.uniq(_.concat(_.map(results[0], 'day'), _.map(results[1], 'day'))), function(d) {
                return { day: d };
            });

            return _.reduce(days, function(memo, d) {

                var e = _.find(results[0], { day: d.day });
                if(!e)
                    _.find(memo, { day: d.day})['evaluated'] = 0;
                else
                    _.find(memo, { day: d.day})['evaluated'] = e.count;

                var n = _.find(results[1], { day: d.day });
                if(!n)
                    _.find(memo, { day: d.day})['notyet'] = 0;
                else
                    _.find(memo, { day: d.day})['notyet'] = n.count;

                return memo;
            }, days);
        })
        .then(function(dirty) {
            return _.reject(dirty, function(x) {
                return moment(x.day).isBefore( moment("2018-06-01"));
                // XXX
            });
        })
        .then(function(definitive) {
            return { json: definitive };
        });
};

function qualitativeGet(req) {
    /* this API use a different logic than the others: associated to the 'req.params.rname',
     * (research name) it pick from the list named `research`, the page count is part of the
     * parameters */
   
    var rname = req.params.rname ? req.params.rname : null;
    var dateCheck = req.params.date ? req.params.date.match(/20\d\d-\d\d-\d\d/) : null;
    var queryDay = dateCheck ? new Date(dateCheck[0]) : null;

    if(!rname || !queryDay)
        return { 'text': 'Invalid query string: /api/v1/qualitative/$RESEARCHNAME/day/$YYYY-MM-DD' };

    var endDay = new Date(
        moment(dateCheck[0]).add(1, 'd').format("YYYY-MM-DD")
    );

    return various
        .loadJSONfile("config/researches.json")
        .then(function(researches) {
            return _.get(researches, req.params.rname);
        })
        .then(function(rsettings) {
            if(!rsettings && !_.isString(rsettings.collection))
                return { text: "Invalid research name" };

            return mongo.read(rsettings.collection, {
                publicationTime: {
                    '$gte': queryDay,
                    '$lte': endDay
                }
            });
        })
        .map(function(post) {
            post.userPseudo = utils.number2Food(_.parseInt(post.userId));
            return post;
        })
        .then(function(objectList) {
            return { json: objectList };
        });
};

function qualitativeUpdate(req) {
    var postId = _.parseInt(req.params.postId) + "";
    var cName = null;

    return various
        .loadJSONfile("config/researches.json")
        .then(function(researches) {
            return _.get(researches, req.params.rname);
        })
        .then(function(rsettings) {
            if(!rsettings && !_.isString(rsettings.collection))
                return { text: "Invalid research name" };

            cName = rsettings.collection;
            return mongo
                .read(rsettings.collection, { postId: postId });
        })
        .then(_.first)
        .then(function(post) {
/*
        > req.body[0]
        { 1764111127007379-subjects-4: true }
 */
            _.each(req.body, function(field) {
                debug("%j", field);
                debugger;
            });

            return mongo
                .updateOne(cName, { postId: postId }, post);
        })
        .then(function(ret) {
            return { json: ret };
        });
};


module.exports = {
    distinct: distinct,     /* API, :autkey as param, used by static page /distinct */
    rdata: rdata,           /* API, group data, :requestList as param */
    rstats: rstats,         /* API, group number, :requestList as param */
    researcher: researcher, /* static page to serve the .pug -- still TBD */

    /*  used by research value adding, check 'config/research.json' for the settings */
    qualitativeGet: qualitativeGet, 
    qualitativeUpdate: qualitativeUpdate,
    qualitativeOverview: qualitativeOverview,

    /* library utility, to parse options */
    optionParse: optionParse
};
