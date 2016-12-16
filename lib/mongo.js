var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var mongodb = Promise.promisifyAll(require('mongodb'));
var debug = require('debug')('mongo');
var nconf = require('nconf');

var dbConnection = function() {
    var url = nconf.get('mongodb');
    return mongodb
        .MongoClient
        .connectAsync(url)
        .disposer(function(db) {
            return db.close();
        });
};

var writeOne = function(cName, dataObject) {
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .insert(dataObject);
    });
};

var upsertOne = function(cName, selector, updated) {
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .updateOne(selector, updated, { upsert: true});
    }); /*
    .tap(function(upsertRet) {
        debug("upsertOne return: %j", upsertRet);
    });  */
};

var writeMany = function(cName, dataObjects) {
    debug("writeMany in %s of %d objects", cName, _.size(dataObjects));
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .insertMany(dataObjects);
    });
};

var read = function(cName, selector, sorter) {
    if(_.isUndefined(sorter)) sorter = {};
    debug("read in %s by %j selector sort by %j", cName, selector, sorter);
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .find(selector)
            .sort(sorter)
            .toArray();
    });
};

var readLimit = function(cName, selector, sorter, limitN, past) {
    if(_.isNaN(past)) past = 0;
    debug("readLimit in %s by %j sort %j max %d past %d", 
        cName, selector, sorter, limitN, past);
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .find(selector)
            .sort(sorter)
            .limit(limitN + past)
            .toArray()
            .then(function(objList) {
                if(past)
                    return _.takeRight(objList, limitN);
                return objList;
            });
    });
};

var countByMatch = function(cName, selector) {
    debug("countByMatch in %s by %j", cName, selector);
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .find(selector)
            .count();
    });
};

var readShard = function(cName, sorter, min, max) {
    debug("readShard in %s sort by %j, skip %d amount %d", 
        cName, sorter, min, max - min);
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .find({})
            .sort(sorter)
            .skip(min)
            .limit(max - min)
            .toArray();
    });
};

/* This is *XXX FIXME* because the mongo query returns a number
 * of record equal to timeline, and this is bad. just I don't know
 * exactly how to keep only the entries with 'users' bigger than X,
 * so I'm doing the filtering with JS. This is used in 'staticpages'
 * and in 'postReality' */
var getPostRelations = function(cName, filter) {
    debug("getPostRelations in %s filter by %j", cName, filter);
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: { "postId": "$postId"},
                        users: { $addToSet: "$userId"},
                        times: { $addToSet: "$displayTime"}
                    }
                }
            ])
            .toArray();
    });
};

var countByDay = function(cName, timeVarName, filter, aggext) {
    debug("countByDay %s timevar '%s' filter %j aggregator ext %j",
        cName, timeVarName, filter, aggext);

    var queryId = { 
        year: { $year: timeVarName },
        month:{ $month: timeVarName },
        day:  { $dayOfMonth: timeVarName }
    };

    if(_.isObject(aggext) && _.size(_.keys(aggext)) > 0) {
        /* for example: { user: "$userId" } */
        queryId = _.extend(queryId, aggext);
        debug("aggregator ext applied: %j", queryId);
    }

    if(!_.startsWith(timeVarName, '$'))
        throw new Error("developer please: mongoVar wants '$'");

    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: queryId,
                        count: { $sum: 1 }
                    }
                }
            ])
            .toArray()
            .catch(function(error) {
                debug("mongo error: %s (%s)", error, cName);
                return [];
            });
    });
};

var countByObject = function(cName, idobj) {
    if(_.isUndefined(idobj)) idobj = {};
    debug("countByObject in %s by %j", cName, idobj);
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .aggregate([
                {
                  $group: {
                    _id: idobj,
                    count: { $sum: 1 }
                  }
                },
                { $sort: { count: -1 } }
            ])
            .toArray()
            .catch(function(error) {
                debug("MongoQuery %s error: %s", cName, error);
                return [];
            });
    });
};

var getRandomUser = function(cName) {
    debug("getRandomUser. REMIND: has hardcoded limits");
    return readLimit(cName, {}, {}, 50, 0)
        .then(function(users) {
            debug("getRandomUser: first user selected %j and last %j",
                _.first(users), _.last(users));
            return _.sample(users).userId;
        });
};

var getNodeStats = function(cList) {
    var columns = [ "supporters", "timelines", "impressions", "htmls", "accesses" ];
    debug("getNodeStats %j", columns);
    return Promise.map(columns, function(cn) {
        return countByMatch(_.get(cList, cn), {});
    })
    .catch(function(error) {
        debug("getNodeStats Error %s", error);
        debugger;
    })
    .then(function(numbers) {
        return _.zipObject( columns, numbers);
    });
};

module.exports = {
    upsertOne: upsertOne,
    writeOne: writeOne,
    writeMany: writeMany,
    readLimit: readLimit,
    readShard: readShard,
    countByDay: countByDay,
    countByMatch: countByMatch,
    countByObject: countByObject,
    getPostRelations: getPostRelations,
    read: read,
    getRandomUser: getRandomUser,
    getNodeStats: getNodeStats,
    dbConnection: dbConnection
};
