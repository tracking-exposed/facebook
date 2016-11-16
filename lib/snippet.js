var _ = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var moment = require('moment');
var debug = require('debug')('snippet');
var nconf = require('nconf');

var mongo = require('./mongo');
var utils = require('./utils');
var error = require('./error');

var htmlMaxAmount = 200;

function updateMetadata(snippet, received) {
    return fs
        .readFileAsync('parsers/' + received.parserName + "-key.json")
        .then(JSON.parse)
        .then(function(fcontent) {
            if(fcontent.key !== received.parserKey)
                throw new Error(
                    "Invalid key supply for parser " + received.parserName);

            _.set(snippet, received.parserName, received.value);
            return _.omit(snippet, ['_id', 'metadata']);
        });
};

function importSelector(body) {
    /* sanitize the request and shape in the proper selector */
    var since = _.get(body, 'since');
    var until = _.get(body, 'until');
    var requirements = _.get(body, 'requirements');
    var ret = { mongoQuery : {} };

    ret.mongoQuery.writingTime = {
        "$gt": new Date(since),
        "$lt": new Date(until)
    };
    ret.parserName = _.get(body, 'parserName');

    if(_.isObject(requirements)) {
        ret.mongoQuery = _.extend(ret.mongoQuery, requirements);
    }
    ret.mongoQuery[ret.parserName] = { $exists: false };

    /* return all the entries that parser has not yet processed */
    return ret;
};


function countQuery(selector) {
    return Promise.using(mongo.dbConnection(), function(db) {
        return db
            .collection(nconf.get('schema').htmls)
            .find(selector)
            .count();
    });
};

function contentQuery(selector) {
    var sortBy = { "writingTime": -1 };
    return Promise.using(mongo.dbConnection(), function(db) {
        return db
            .collection(nconf.get('schema').htmls)
            .find(selector)
            .sort(sortBy)
            .limit(htmlMaxAmount)
            .toArray();
    });
};

/* first function called, to get the amount of snippet */
function snippetAvailable(req) {
    var userReq = importSelector(req.body);
    return countQuery(userReq.mongoQuery)
        .then(function(result) {
            debug("Status check result for %s: %d HTMLs",
                userReq.parserName, result);
            return { json: {
              'available': result,
              'limit': htmlMaxAmount
            }};
        });
};

/* second functon called, to get the actual snippet */
function snippetContent(req) {
    var userReq = importSelector(req.body);

    return contentQuery(userReq.mongoQuery)
        .then(function(htmls) {
            debug("Returned %d HTML snippets for %s",
                _.size(htmls), userReq.parserName);
            return { json: htmls };
        });
};

function keysNotInit() {
    return (_.isUndefined(process.env.keys) ||
            _.isUndefined(process.env.keys[parserName]) );
}

/* third function, to commit the snippet extracted metadata */
function snippetResult(req) {
    var received = {
        htmlId: _.get(req.body, 'snippetId'),
        parserKey: _.get(req.body, 'parserKey'),
        value: _.first(_.values(_.get(req.body, 'metadata'))),
        parserName: _.first(_.keys(_.get(req.body, 'metadata')))
    };
    return contentQuery({ 'id': received.htmlId }, {})
        .then(function(snippet) {
            return updateMetadata(_.first(snippet), received);
        })
        .then(function(updated) {
            return mongo
                .upsertOne(
                    nconf.get('schema').htmls,
                    { id: updated.id }, updated
                )
                .return({ json: {
                    'status': 'updated',
                    'metadata': _.omit(updated, ['html']),
                    'id': updated.htmlId
                }});
        })
        .catch(function(error) {
            debug("Error! %s", error);
            return { json: { 'error': error } };
        });
};


module.exports = {
    snippetAvailable: snippetAvailable,
    snippetContent: snippetContent,
    snippetResult: snippetResult,
};
