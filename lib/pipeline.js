const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('lib:pipeline');
const mongo = require('./mongo');

async function countByDay(cName, timeVarName, filter, aggext) {
    /* timeVarName is 'impressionTime' or 'savingTime' ... */
    if(!_.startsWith(timeVarName, '$'))
        throw new Error("developer please: timeVarName wants '$'");

    const mongoc = await mongo.clientConnect({concurrency: 1});
    const queryId = { 
        year:  { $year: timeVarName },
        month: { $month: timeVarName },
        day:   { $dayOfMonth: timeVarName }
    };

    if(_.isObject(aggext) && _.size(_.keys(aggext)) > 0) {
        /* such as { user: "$userId" } */
        _.extend(queryId, aggext);
    }

    const totalQ = [
        { $match: filter },
        { $group: {
            _id: queryId,
            count: { $sum: 1 }
        }}];

    debug("countByDay[%s] %j", cName, filter);
    let results = await mongo.aggregate(mongoc, cName, totalQ);

    results = _.map(results, function(e) {
        e.date = `${e._id.year}-${e._id.month}-${e._id.day}`;
        _.unset(e, '_id');
        return e;
    });
    debug("countByDay returns %d docs", _.size(results));

    await mongoc.close();
    return results;
};

async function countByFeature(cName, filter, looker) {
    if(!_.startsWith(looker, '$'))
        throw new Error("developer please: looker wants '$'");

    const mongoc = await mongo.clientConnect({concurrency: 1});
    const totalQ = [
        { $match: filter },
        { $group: {
            _id: looker,
            amount: { $sum: 1 }
        }},
        { $sort: { count: -1 } }
    ];

    debug("countByFeature[%s] by [%j] %s", cName, filter, looker);
    let results = await mongo.aggregate(mongoc, cName, totalQ);
    const origName = _.replace(looker, /\$/, '');
    let avg = 0;
    results = _.map(results, function(e) {
        e[origName] = e._id;
        _.unset(e, '_id');
        avg += e.amount;
        return e;
    });
    avg = _.round(avg / _.size(results), 1);
    debug("countByFeature returns %d docs, 'amount' avg %d", _.size(results), avg);

    await mongoc.close();
    return results;
};


module.exports = {
    countByDay,
    countByFeature,
};
