const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('lib:dbutils');
const mongo = require('./mongo');

async function checkMongoWorks() {

    try {
        const mongoc = await mongo.clientConnect({concurrency: 1});
        let results = await mongo.listCollections(mongoc);
        await mongoc.close();
        return results;
    } catch(error) {
        debug("Failure in checkMongoWorks: %s", error.message);
        return false;
    }
};

module.exports = {
    checkMongoWorks,
};

/*
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

*/
