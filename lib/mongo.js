var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var mongodb = Promise.promisifyAll(require('mongodb'));
var debug = require('debug')('lib:mongo');
var debugread = require('debug')('lib:mongo:read');
var debugcount = require('debug')('lib:mongo:count');
var nconf = require('nconf');

var dbConnection = function() {
    var url = nconf.get('mongodb');
    // debug("using mongourl %s", url);
    return mongodb
        .MongoClient
        .connectAsync(url)
        .disposer(function(db) {
            return db.close();
        });
};

function doesMongoWorks() {
    return Promise.using(dbConnection(), function(db) {
        return db
            .listCollections()
            .toArray();
    })
    .map(function(entry) {
        return _.get(entry, 'name');
    });
};

var writeOne = function(cName, dataObject) {
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .insert(dataObject);
    })
    .return(dataObject);
};

var updateOne = function(cName, selector, updated) {
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .updateOne(selector, updated);
    })
    .return(updated);
};

/* better safe than sorry */
var upsertOne = function(cName, selector, updated) {
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .updateOne(selector, updated, {upsert: true});
    })
    .return(updated);
};

function writeMany(cName, dataObjects) {
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .insertMany(dataObjects);
    })
};

function readOne(cName, selector, sorter) {
    return read(cName, selector, sorter)
        .then(_.first);
};

function read(cName, selector, sorter) {
    if(_.isUndefined(sorter)) sorter = {};
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .find(selector)
            .sort(sorter)
            .toArray();
    })
    .tap(function(rv) {
        debugread("R %s %j → %d objs", cName, selector, _.size(rv));
    });
};

function remove(cName, selector) {

    if(_.size(_.keys(selector)) === 0)
        throw new Error("Nope, you can't delete {} ");

    debug("Removing documents %j from %s", selector, cName);
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .remove(selector);
    })
};

var readLimit = function(cName, selector, sorter, limitN, past) {
    if(_.isNaN(past)) past = 0;
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .find(selector)
            .sort(sorter)
            .skip(past)
            .limit(limitN)
            .toArray()
    })
    .tap(function(rv) {
        debugread("RL %s %j %s %s →  %d objs", cName, selector,
            limitN ? "limit " + limitN : "",
            past ? "skip " + past : "",
            _.size(rv)
        );
    })
    .catch(function(errstr) {
        debug("Error in readLimit!: %s", errstr);
        return [];
    });
};

function count(cName, selector) {
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .count(selector);
    })
    .tap(function(result) {
        debugcount("count in %s by %j = %d", cName, selector, result);
    });
};

function grouping(cName, match, group) {
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .grouping([
                { $match: match },
                { $group: group }
            ])
            .toArray();
    })
    .tap(function(ret) {
        debug("grouping %s match %s group %s → %d entries",
            cName, JSON.stringify(match),
            JSON.stringify(group), _.size(ret));
    })
};

function aggregate(cName, pipeline) {
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .aggregate(pipeline)
            .toArray();
    })
    .tap(function(ret) {
        debug("aggregate in %s pipeline %j results for %d entry",
            cName, _.map(pipeline, _.keys), _.size(ret)
        );
    })
};

var countByDay = function(cName, timeVarName, filter, aggext) {

    if(!_.startsWith(timeVarName, '$'))
        throw new Error("developer please: mongoVar wants '$'");

    var queryId = { 
        year:  { $year: timeVarName },
        month: { $month: timeVarName },
        day:   { $dayOfMonth: timeVarName }
    };

    if(_.isObject(aggext) && _.size(_.keys(aggext)) > 0) {
        /* for example: { user: "$userId" } */
        queryId = _.extend(queryId, aggext);
    }

    var totalQ = [
        { $match: filter },
        { $group: {
            _id: queryId,
            count: { $sum: 1 }
        }}];

    debug("countByDay on %s %j  → ", cName, filter);
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .grouping(totalQ)
            .toArray()
            .catch(function(error) {
                debug("countByDay error: %s (%s)", error, cName);
                return [];
            });
    })
    .tap(function(done) {
        debug("← countByDay on %s F %j[%j] got %d",
            cName, filter, aggext, _.size(done));
    });
};

var countByObject = function(cName, idobj) {
    if(_.isUndefined(idobj)) idobj = {};
    debug("countByObject in %s by %j", cName, idobj);
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .grouping([
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
                debug("countByObject error: %s (%s)", error, cName);
                return [];
            });
    })
};

function lookup(cName, query, sequence) {
    // debug("lookup on %s of %j + %j", cName, query, sequence);

    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .grouping([ query, sequence ])
            .toArray()
            .catch(function(error) {
                debug("lookup in %s error: %s", cName, error);
                return [];
            });
    })
};

function save(cName, doc) {
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .save(doc);
    });
};

function createIndex(cName, index, opt) {
    return Promise.using(dbConnection(), function(db) {
        return db.ensureIndex(cName, index, opt);
    })
    .tap(function(results) {
        debug("indexes created on %s: %j = %j", cName, index, results);
    });
};

function distinct(cName, field, query) {
    debug("distinct in %s for %s with %j", cName, field, query);
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .distinct(field, query);
    })
    .tap(function(results) {
        debug("distinct on %s, on %s: %d elements", cName, field, _.size(results));
    });
};

module.exports = {
    doesMongoWorks: doesMongoWorks,
    updateOne: updateOne,
    upsertOne: upsertOne,
    writeOne: writeOne,
    writeMany: writeMany,
    readLimit: readLimit,
    countByDay: countByDay,
    count: count,
    countByObject: countByObject,
    read: read,
    readOne: readOne,
    remove: remove,
    grouping: grouping,
    aggregate: aggregate,
    lookup: lookup,
    save: save,
    createIndex: createIndex,
    distinct: distinct
};

