const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');
const debug = require('debug')('routes:personal');
const nconf = require('nconf');

const mongo = require('../lib/mongo');
const params = require('../lib/params');
const adopters = require('../lib/adopters');
const csv = require('../lib/CSV');

function summary(req) {
    const { amount, skip } = params.optionParsing(req.params.paging, 200);
    debug("summary request, amount %d skip %d", amount, skip);

    return adopters
        .validateToken(req.params.userToken)
        .then(function(supporter) {
            return mongo
                .readLimit(nconf.get('schema').summary, { user: supporter.pseudo },
                    { impressionTime: -1}, amount, skip);
        })
        .map(function(e) {
            return _.omit(e, ['_id' ]);
        })
        .then(function(data) {
            debug("retrived %d objects, with amount %d skip %d", _.size(data), amount, skip);
            return { json: data };
        })
        .catch(function(e) {
            debug("Summary (error): %s", e.message);
            return { json: { error: true, 'message': `error: ${e.message}` }};
        });
};

function personalCSV(req) {
    const { amount, skip } = params.optionParsing(req.params.paging, 1000);
    debug("CSV request by [%s], amount %d skip %d", req.params.userToken, amount, skip);

    let fname = "summary-"
    return adopters
        .validateToken(req.params.userToken)
        .then(function(supporter) {
            fname=`${fname}-${supporter.pseudo}.csv`;
            return mongo
                .readLimit(nconf.get('schema').summary, { user: supporter.pseudo },
                    { impressionTime: -1}, amount, skip);
        })
        .tap(function(check) {
            if(!_.size(check))
                throw new Error
                    ("I wasn't beliving anyone use this API, so I'm just checking if actually someone see this error. please email claudio at tracking dot exposed, as I don't belive any of you exist");
        })
        .then(csv.produceCSVv1)
        .then(function(structured) {
            debug("personalCSV produced %d bytes", _.size(structured));
            return {
                headers: { "Content-Type": "csv/text",
                           "content-disposition": `attachment; filename=${fname}` },
                text: structured,
            };
        })
        .catch(function(e) {
            debug("csv (error): %s", e.message);
            return {
                headers: { "Content-Type": "csv/text",
                           "content-disposition": `attachment; filename=error.csv` },
                text: `error: ${e.message}`
            };
        });
}

function metadata(req) {
    const { amount, skip } = params.optionParsing(req.params.paging);
    debug("metadata request: %d skip %d", amount, skip);
    return adopters
        .validateToken(req.params.userToken)
        .then(function(supporter) {
            return mongo
                .readLimit(nconf.get('schema').metadata, { userId: supporter.userId },
                    { impressionTime: -1}, amount, skip);
        })
        .then(function(data) {
            debug("retrived %d objects, with amount %d skip %d", _.size(data), amount, skip);
            return { json: data };
        })
        .catch(function(e) {
            debug("Metadata (error): %s", e.message);
            return { json: { error: true, 'message': `error: ${e.message}` }};
        });
};

function enrich(req) {
    /* reminder: this API allow two different method of paging, for example
     * you can ask a specific day */

    var amount = 0, skip, pipeline, when = null;
    if(!req.params.paging || _.size(_.split(req.params.paging, '-')) == 2) {
        let paging = params.optionParsing(req.params.paging);
        amount = paging.amount;
        skip = paging.skip;
        debug("enrich with paging, looking for %d, skip %d", amount, skip);
    }
    else {
        when = moment(req.params.paging);
        amount = 100;
        debug("enrich by day: looking for %s forced limit at 100!", when);
    }

    if( (when != null && !when.isValid()) || (when == null && !amount) )
        throw new Error("Invalid parameter: $amount-$skip OR $(year-$month-day)")

    /* pipeline should be:
            match, limit, sort, lookup
       the match and limits are added below in the promise chain */
    let lookup = [
        { $lookup: {
            from: 'labels',
            localField: 'semanticId',
            foreignField: 'semanticId',
            as: 'labelcopy'
        }}
    ];

    let pseudo = null;
    return adopters
        .validateToken(req.params.userToken)
        .then(function(supporter) {
            pseudo = supporter.pseudo;
            if(when) {
                const startOf = new Date(when.startOf('day').toISOString());
                const endOf = new Date(when.add(1, 'd').startOf('day').toISOString());
                pipeline = _.concat([
                    { $match: {
                        userId: supporter.userId,
                        impressionTime: { $lt: endOf, $gt: startOf }
                    } },
                    { $sort: { impressionTime: -1 } },
                ], lookup);
            } else {
                pipeline = _.concat([
                    { $match: { user: supporter.pseudo } },
                    { $sort: { impressionTime: -1 } },
                    { $skip: skip },
                    { $limit: amount },
                ], lookup);
            }
            return mongo
                .aggregate(nconf.get('schema').metadata, pipeline);
        })
        .map(function(e) {
            if(_.size(e.labelcopy)) {
                e.labels = _.get(e.labelcopy[0], 'l');
                e.lang = _.get(e.labelcopy[0], 'lang');
            }
            _.set(e, 'user', pseudo);
            e.images = _.filter(e.images, {linktype: 'cdn'});
            e = _.omit(e, ['_id', 'pseudo', 'paadc', 'labelcopy', 'regexp', 'opengraph',
                'usertext', 'interactions', 'images.profiles', 'indicators',
                'summary', 'userId', 'notes', 'when' ]);
            return e;
        })
        .then(function(prod) {
            debug("Returning %d enriched entries, the most recent from %s from %s",
                _.size(prod), prod[0].impressionTime, prod[0].user);
            return { json: prod };
        })
        .catch(function(e) {
            debug("Enrich (error): %s", e.message);
            return { json: { error: true, 'message': `error: ${e.message}` }};
        });
};

function byTimelineLookup(userId, amount, skipnum) {
    /* let me intrduce you to the bigger pipeline of this code iteration */

    const match = { $match: {userId: userId }};
    const sort = { $sort: { startTime: -1 }};
    const skip = { $skip: skipnum };
    const limit = { $limit: amount };
    const lookup = { $lookup: { from: 'impressions2', localField: 'id', foreignField: 'timelineId', as: 'impressions'}};
    const unwind = { $unwind: { path: "$impressions", preserveNullAndEmptyArrays: true } };
    const project = { $project: {
        _id: 0,
        "impressionOrder": "$impressions.impressionOrder",
        "impressionTime": "$impressions.impressionTime",
        "htmlId": "$impressions.htmlId",
        "visibility": "$impressions.visibility",
        geoip: 1,
        startTime: 1,
        "timelineId": "$id"
    }};

    return mongo
        .aggregate(nconf.get('schema').timelines, [ match, sort, skip, limit, lookup, unwind, project ]);
};

function stats(req) {

    const DEFTIMLN = 20;
    const { amount, skip } = params.optionParsing(req.params.paging, DEFTIMLN);

    debug("Personal statistics requested, it process timelines: amount %d skip %d",
        amount, skip);

    return adopters
        .validateToken(req.params.userToken)
        .then(function(supporter) {
            return Promise.all([
                mongo.count(nconf.get('schema').timelines, { userId: supporter.userId }),
                byTimelineLookup(supporter.userId, amount, skip)
            ])
        })
        .then(function(result) {
            const timelines = _.countBy(result[1], 'timelineId')
            debug("Retrieved %d impressions in %d timelines, first %s, last %s",
                _.size(result[1]), _.size(timelines), _.first(result[1]).impressionTime, _.last(result[1]).impressionTime);

            /* order the timeline by startTime and impressionOrder */
            const orderedTimelines = _.map(_.map(_.groupBy(result[1], 'timelineId'), _.first), 'startTime');
            let sorted = [];
            _.each(_.orderBy(orderedTimelines, new Date), function(sT) {
                sorted = _.concat(sorted, _.orderBy(_.filter(result[1], { startTime: sT }), 'impressionOrder'));
            });

            return {
                json: {
                    storedTimelines: result[0],
                    served: { amount, skip },
                    content: sorted,
                    timelines,
                }
            };
        })
        .catch(function(e) {
            debug("Stats (error): %s", e.message);
            return { json: { error: true, 'message': `error: ${e.message}` }};
        });

};

function daily(req) {

    const MINIMUM_AMOUNT = 3;
    const { amount, skip } = params.optionParsing(req.params.paging, 3);
    const dayamount = ( amount < MINIMUM_AMOUNT ) ? MINIMUM_AMOUNT : amount;

    debug("Personal daily statistics - skip %d amount %d [MIN %d]",
        skip, dayamount, MINIMUM_AMOUNT);

    const startTime = moment().startOf('day').subtract(dayamount, 'day').subtract(skip, 'day');
    const endTime = moment().endOf('day').subtract(skip, 'day');
    let pseudo = null;

    return adopters
        .validateToken(req.params.userToken)
        .then(function(supporter) {
            pseudo = supporter.pseudo;
            return mongo.aggregate(nconf.get('schema').metadata, [
                { $match: { userId: supporter.userId,
                        impressionTime: { "$gte": new Date(startTime.toISOString()),
                                          "$lte": new Date(endTime.toISOString())}
                      },
                },
                { $sort: { impressionTime: 1}},
                { $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$impressionTime" } },
                    timelines: { $push: "$timelineId" },
                    sum  : { $sum: 1},
                    publisherNames: { $push: "$publisherName" },
                    nature: { $push: "$nature.kind"},
                    first: { $first: "$impressionTime" },
                    checkf: { $first: "$impressionOrder" },
                    last: { $last: "$impressionTime" },
                    checkl: { $last: "$impressionOrder" }
                }}
          ]);
        })
        .map(function(e) {
          let d = moment.duration(moment(e.last) - moment(e.first));
          e.totalSeconds = d.asSeconds();
          e.duration = d.humanize();
          e.npost = e.publisherNames.length;
          e.ntimelines = _.uniq(e.timelines).length;
          e.sources = _.uniq(e.publisherNames).length;
          e.day = e._id;
          e.dayTime = moment(e.first).startOf('day').toISOString();
          _.unset(e, '_id');
          return e;
        })
        .then(function(stats) {
            debug("Retrieved daily stats: amount %d info: %j %j",
                _.size(stats), _.map(stats, 'duration'), _.map(stats, 'npost'));
            return { json: { dayamount, skipped: skip, stats, pseudo }} ;
        })
        .catch(function(e) {
            debug("Daily (error): %s", e.message);
            return { json: { error: true, 'message': `error: ${e.message}` }};
        });
};

module.exports = {
    summary,
    metadata,
    personalCSV,
    enrich,
    daily,
    stats
};
