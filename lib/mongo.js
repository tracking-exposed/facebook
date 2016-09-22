var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var mongodb = Promise.promisifyAll(require('mongodb'));
var debug = require('debug')('mongo');
var nconf = require('nconf');

var dbConnection = function() {
    if(_.isUndefined(nconf.get('mongodb')))
        var url = 'mongodb://localhost/facebook';
    else
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
            .insert(dataObject)
            .then(function(results) {
                return true;
            })
            .catch(function(error) {
                debug("writeOne Error %s (%j)", cName, error);
                return false;
            });
    });
};

var updateOne = function(cName, selector, updated) {
    debug("updateOne in %s selector %j ", cName, selector);
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .updateOne(selector, updated, { upsert: true})
            .then(function(result) {
                return true;
            })
            .catch(function(error) {
                debug("updateOne Error %s (%j)", cName, error);
                return false;
            });
    });
};

var writeMany = function(cName, dataObjects) {
    debug("writeMany in %s of %d objects", cName, _.size(dataObjects));
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .insertMany(dataObjects)
            .then(function(results) {
                return true;
            })
            .catch(function(error) {
                if(!_.size(dataObjects)) {
                    debug("Zero dataObject justify an error (%s)", error);
                    return true;
                }
                debug("writeMany Error %s (%j)", cName, error);
                return false;
            });
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

var count = function(cName, selector) {
    debug("count in %s by %j selector", cName, selector);
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .count()
            .then(function(results) {
                /* anything to do here ? I don't think so */
                return results;
            });
    });
};

var aggregate = function(cName, queryObject) {
    debug("aggregate get called in %s for %j", cName, queryObject);
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .aggregateAsync(queryObject);
    });
};

var countByDay = function(cName, timeVarName, filter) {
    debug("countByDay in %s, using time variable '%s' filter %j",
        cName, timeVarName, filter);

    if(!_.startsWith(timeVarName, '$'))
        throw new Error("developer please, MongoVar wants '$' ");

    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: { 
                            year: { $year: timeVarName },
                            month:{ $month: timeVarName },
                            day:  { $dayOfMonth: timeVarName }
                        },
                        count: { $sum: 1 }
                    }
                }
            ])
            .toArray()
            .catch(function(error) {
                debug("MongoQuery error: %s, from %s", error, cName);
                return [];
            });
    });
};

var usersByDay = function(cName) {
    debug("countActiveUsersByDay in %s", cName);
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .aggregate([
                { $group: {
                    _id: {
                            year: { $year: "$displayTime" },
                            month:{ $month: "$displayTime" },
                            day:  { $dayOfMonth: "$displayTime" },
                            user: "$userId"
                        },
                        count: { $sum: 1 }
                    }
                }
            ])
            .toArray()
            .catch(function(error) {
                debug("MongoQuery error: %s, from %s", error, cName);
                return [];
            });
    });
};


module.exports = {
    aggregate: aggregate,
    writeOne: writeOne,
    writeMany: writeMany,
    updateOne: updateOne,
    readLimit: readLimit,
    readShard: readShard,
    countByDay: countByDay,
    usersByDay: usersByDay,
    read: read,
    count: count
};
