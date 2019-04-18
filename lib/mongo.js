const _ = require('lodash');
const moment = require('moment');
const MongoClient = require('mongodb').MongoClient;
const debug = require('debug')('lib:mongo');
const nconf = require('nconf');

var savedMongoUri = null;
function mongoUri(forced) {

    if(forced) {
        savedMongoUri = forced;
        return forced;
    }

    if(_.isUndefined(forced) && savedMongoUri)
        return savedMongoUri;

    /* when is null, it reset */
    const mongoHost = nconf.get('mongoHost');
    const mongoPort = nconf.get('mongoPort');
    const mongoDb = nconf.get('mongoDb');

    if(!mongoHost || !mongoPort || !mongoDb)
        throw new Error("configuration missing");

    savedMongoUri = `mongodb://${mongoHost}:${mongoPort}/${mongoDb}`;
    debug("Initializing mongoUri with %s", savedMongoUri);
    return savedMongoUri;
}

function clientConnect(config) {
    /* concurrency: <Int>, uri: <mongo address> */
    if(!config) config = {};

    const poolSize = config.concurrency ? config.concurrency : 10;
    mongoUri(config.uri);
    /* 
     * this is make with (some) cargo cult programming
     * I don't fully understand if is the most optimal way. 
     * Please, if you have input about this, my goal is 
     * don't open a mongo connection every time the caller 
     * execute a query
     */
    return new Promise((resolve, reject) => (
        MongoClient.connect(mongoUri(), {
            poolSize,
            useNewUrlParser: true
        }, (err, client) => {
            if(err) {
                err.message = `mongo.clientConnect error in connecting at ${mongoUri()}`;
                debug(err.message);
                reject(err);
            } else {
                resolve(client);
            }
        })
    ))
};

function listCollections(mongoc) {
    return mongoc
        .db()
        .listCollections()
        .toArray();
};

function writeOne(mongoc, cName, doc) {
    return mongoc
        .db()
        .collection(cName)
        .insertOne(doc);
};

function insertMany(mongoc, cName, docs, options) {
    if(!options) options = {};
    return mongoc
        .db()
        .collection(cName)
        .insertMany(docs, options);
};

function updateOne(mongoc, cName, selector, updated) {
    return mongoc
        .db()
        .collection(cName)
        .updateOne(selector, { $set: updated });
};

function upsertOne(mongoc, cName, selector, updated) {
    return mongoc
        .db()
        .collection(cName)
        .updateOne(selector, { $set: updated }, { upsert: true});
};

function read(mongoc, cName, selector, sorter) {
    return mongoc
        .db()
        .collection(cName)
        .find(selector)
        .sort(sorter ? sorter : {})
        .toArray();
};

async function readOne(mongoc, cName, selector, sorter) {
    const l = await read(mongoc, cName, selector, sorter);
    if(_.size(l) > 1)
        debug("Warning, readOne %j returned %d docs", selector, _.size(l));
    return _.first(l);
};

function deleteMany(mongoc, cName, selector) {
    if(_.size(_.keys(selector)) === 0)
        throw new Error("Not in my watch: you can't delete everything with this library");
    return mongoc
        .db()
        .collection(cName)
        .deleteMany(selector);
};

function readLimit(mongoc, cName, selector, sorter, limitN, past) {
    if(!limitN)
        throw new Error("Not specified the amount of documents expected");
    return mongoc
        .db()
        .collection(cName)
        .find(selector)
        .sort(sorter)
        .skip(past ? past : 0)
        .limit(limitN)
        .toArray();
};

function count(mongoc, cName, selector) {
    return mongoc
        .db()
        .collection(cName)
        .count(selector);
};


function createIndex(mongoc, cName, index, opt) {
    return mongoc
        .db()
        .createIndex(cName, index, opt);
};

function distinct(mongoc, cName, field, query) {
    return mongoc
        .db()
        .collection(cName)
        .distinct(field, query);
};

function aggregate(mongoc, cName, pipeline) {
    return mongoc
        .db()
        .collection(cName)
        .aggregate(pipeline)
        .toArray();
};

module.exports = {
    clientConnect,
    mongoUri,

    listCollections,
    writeOne,
    insertMany,
    updateOne,
    upsertOne,
    readOne,
    read,
    readLimit,
    deleteMany,
    count,
    createIndex,
    distinct,
    aggregate,
};

