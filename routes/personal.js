const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');
const debug = require('debug')('routes:personal');
const nconf = require('nconf');

const mongo = require('../lib/mongo');
const params = require('../lib/params');
const utils = require('../lib/utils');
const adopters = require('../lib/adopters');
const produceCSVv1 = require('../lib/CSV');

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
            debug("Summary (error): %s", e);
            return { json: { error: true, 'message': `error: ${e}` }};
        });
};

function personalCSV(req) {
    const { amount, skip } = params.optionParsing(req.params.paging, 1000);
    debug("CSV request by [%s], amount %d skip %d", req.params.userToken, amount, skip);

    return adopters
        .validateToken(req.params.userToken)
        .then(function(supporter) {
            return mongo
                .readLimit(nconf.get('schema').summary, { user: supporter.pseudo },
                    { impressionTime: -1}, amount, skip);
        })
        .tap(function(check) {
            if(!_.size(check)) throw new Error("Invalid token");
        })
        .then(produceCSVv1)
        .then(function(structured) {
            debug("personalCSV produced %d bytes", _.size(structured));
            const fname=`summary-${skip}-${amount}.csv`;
            return {
                headers: { "Content-Type": "csv/text",
                           "content-disposition": `attachment; filename=${fname}` },
                text: structured,
            };
        })
        .catch(function(e) {
            debug("csv (error): %s", e);
            return {
                headers: { "Content-Type": "csv/text",
                           "content-disposition": `attachment; filename=error.csv` },
                text: `error: ${e}`
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
            debug("Metadata (error): %s", e);
            return { json: { error: true, 'message': `error: ${e}` }};
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
        debug("enrich by day: looking for %s", when);
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

    return adopters
        .validateToken(req.params.userToken)
        .then(function(supporter) {

            if(when) {
                const startOf = new Date(when.startOf('day').toISOString());
                const endOf = new Date(when.add(1, 'd').startOf('day').toISOString());
                pipeline = _.concat([
                    { $match: {
                        user: supporter.pseudo,
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
                .aggregate(nconf.get('schema').summary, pipeline);
        })
        .map(function(e) {
            if(_.size(e.labelcopy)) {
                e.labels = _.get(e.labelcopy[0], 'l');
                e.lang = _.get(e.labelcopy[0], 'lang');
            }
            return _.omit(e, ['_id', 'id', 'labelcopy' ]);
        })
        .then(function(prod) {
            debug("Returning %d enriched entries, the most recent from %s",
                _.size(prod), prod[0].impressionTime);
            return { json: prod };
        })
        .catch(function(e) {
            debug("Enrich (error): %s", e);
            return { json: { error: true, 'message': `error: ${e}` }};
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
        geoip: 1,
        startTime: 1,
        "timelineId": "$id"
    }};
    const summaryl = { $lookup: { from: 'summary', localField: 'htmlId', foreignField: 'id', as: 'summary'  }};

    return mongo
        .aggregate(nconf.get('schema').timelines, [ match, sort, skip, limit, lookup, unwind, project, summaryl ]);
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
            debug("Stats (error): %s", e);
            return { json: { error: true, 'message': `error: ${e}` }};
        });

};

function daily(req) {

    const MINIMUM_AMOUNT = 3;
    const { amount, skip } = params.optionParsing(req.params.paging, 3);
    const dayamount = ( amount < MINIMUM_AMOUNT ) ? MINIMUM_AMOUNT : amount;
    const maxday = moment()
        .startOf('day')
        .add(1, 'd')
        .subtract(skip, 'd');

    debug("Personal daily statistics - skip %d amount %d (MINIMUM_AMOUNT %d)",
        skip, dayamount, MINIMUM_AMOUNT);

    return adopters
        .validateToken(req.params.userToken)
        .then(function(supporter) {
            return mongo.readLimit(nconf.get('schema').tmlnstats, { 
                userId: supporter.userId,
                dayTime: {
                    $lte: new Date(maxday.toISOString())
                }
            }, { dayTime: -1 }, dayamount, skip);
        })
        .map(function(e) {
            return _.omit(e, ['_id', 'userId']);
        })
        .then(function(stats) {
            debug("Retrieved daily stats: amount %d info: %j %j",
                _.size(stats), _.map(stats, 'duration'), _.map(stats, 'npost'));
            return { json: stats };
        })
        .catch(function(e) {
            debug("Daily (error): %s", e);
            return { json: { error: true, 'message': `error: ${e}` }};
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
