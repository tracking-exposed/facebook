var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var mongodb = Promise.promisifyAll(require('mongodb'));
var debug = require('debug')('lib:mongo');
var nconf = require('nconf');

var performa = require('./performa');

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
    var p = performa.begin('writeOne',  cName, null);
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .insert(dataObject);
    })
    .tap(function() { return performa.complete(p); });
};

var updateOne = function(cName, selector, updated) {
    var p = performa.begin('updateOne',  cName, {
        'selector': selector
    });
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .updateOne(selector, updated);
    })
    .tap(function() { return performa.complete(p); });
};

var writeMany = function(cName, dataObjects) {
    var p = performa.begin('writeMany',  cName, {
        'size': _.size(dataObjects)
    });
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .insertMany(dataObjects);
    })
    .tap(function() { return performa.complete(p); });
};

var read = function(cName, selector, sorter) {
    if(_.isUndefined(sorter)) sorter = {};
    var p = performa.begin('read',  cName, {
        'selector': selector,
        'sorter': sorter
    });
    debug("read in %s by %j selector sort by %j", cName, selector, sorter);
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .find(selector)
            .sort(sorter)
            .toArray();
    })
    .tap(function() { return performa.complete(p); });
};

var remove = function(cName, selector) {

    if(_.size(_.keys(selector)) === 0)
        throw new Error("Nope, you can't delete {} ");

    var p = performa.begin('remove',  cName, {
        'selector': selector
    });

    debug("Removing documents %j from %s", selector, cName);
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .remove(selector);
    })
    .tap(function() { return performa.complete(p); });
};

var readLimit = function(cName, selector, sorter, limitN, past) {
    if(_.isNaN(past)) past = 0;
    var p = performa.begin('readLimit',  cName, {
        'selector': selector,
        'sorter': sorter,
        'limit': limitN,
        'skip': skip
    });
    debug("readLimit in %s by %j sort %j max %d past %d", 
        cName, selector, sorter, limitN, past);
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .find(selector)
            .sort(sorter)
            .skip(past)
            .limit(limitN)
            .toArray()
    })
    .tap(function() { return performa.complete(p); });
};

var countByMatch = function(cName, selector) {
    var p = performa.begin('countByMatch',  cName, {
        'selector': selector
    });
    debug("countByMatch in %s by %j", cName, selector);
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .find(selector)
            .count();
    })
    .tap(function() { return performa.complete(p); });
};

var aggregate = function(cName, match, group) {
    var p = performa.begin('aggregate',  cName, {
        'selector': match,
        'group': group
    });
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .aggregate([
                { $match: match },
                { $group: group }
            ])
            .toArray();
    })
    .tap(function(ret) {
        debug("aggregate %s [%j%j] result %d entries",
            cName, match, group, _.size(ret));
    })
    .tap(function() { return performa.complete(p); });
};

/* This is *XXX FIXME* because the mongo query returns a number
 * of record equal to timeline, and this is bad. just I don't know
 * exactly how to keep only the entries with 'users' bigger than X,
 * so I'm doing the filtering with JS. This is used in 'staticpages'
 * and in 'postReality' */
var getPostRelations = function(cName, filter) {
    throw new Error("Unsupported ATM");

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
    })
    .tap(function() { return performa.complete(p); });
};

var countByDay = function(cName, timeVarName, filter, aggext) {

    if(!_.startsWith(timeVarName, '$'))
        throw new Error("developer please: mongoVar wants '$'");

    var p = performa.begin('countByDay',  cName, {
        'timeVariable': timeVarName,
        'selector': filter,
        'group': aggext
    });
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

    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .aggregate(totalQ)
            .toArray()
            .catch(function(error) {
                debug("mongo error: %s (%s)", error, cName);
                return [];
            });
    })
    .tap(function() { return performa.complete(p); });
};

var countByObject = function(cName, idobj) {
    if(_.isUndefined(idobj)) idobj = {};
    debug("countByObject in %s by %j", cName, idobj);
    var p = performa.begin('countByObject',  cName, {
        'group': idobj
    });
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
    })
    .tap(function() { return performa.complete(p); });
};


function cacheFlush(cache, name) {

    debug("Flushing cache `%s` of %d elements", name, _.size(cache) );

    var javascriptLovableCopy = new Array();
    _.times( _.size(cache), function(i) {
        javascriptLovableCopy.push(cache.pop() );
    });

    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(nconf.get('schema').performa)
            .insertMany(javascriptLovableCopy);
    });
};

module.exports = {
    updateOne: updateOne,
    writeOne: writeOne,
    writeMany: writeMany,
    readLimit: readLimit,
    countByDay: countByDay,
    countByMatch: countByMatch,
    countByObject: countByObject,
    getPostRelations: getPostRelations,
    read: read,
    remove: remove,
    aggregate: aggregate,
    cacheFlush: cacheFlush
};
