var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var mongodb = Promise.promisifyAll(require('mongodb'));
var debug = require('debug')('mongo');

var dbConnection = function() {
    return mongodb
        .MongoClient
        .connectAsync('mongodb://localhost/facebook')
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
                debug("writeOne in %s: %j done!", cName, dataObject);
                return true;
            })
            .catch(function(error) {
                debug("writeOne Error %s (%j)", cName, error);
                return false;
            });
    });
};

var writeMany = function(cName, dataObjects) {
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .insertMany(dataObjects)
            .then(function(results) {
                debug("%s Saved in %s, %d entries", 
                    moment().format("hh:mm:ss"), cName, _.size(results.ops));
                return true;
            })
            .catch(function(error) {
                debug("writeMany Error %s (%j)", cName, error);
                return false;
            });
    });
};

var read = function(cName, selector) {
    return Promise.using(dbConnection(), function(db) {
        return db
            .collection(cName)
            .find(selector)
            .toArray();
    });
};

var count = function(cName, selector) {
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

module.exports = {
    aggregate: aggregate,
    writeOne: writeOne,
    writeMany: writeMany,
    read: read,
    count: count
};
