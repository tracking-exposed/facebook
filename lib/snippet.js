var _ = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var moment = require('moment');
var debug = require('debug')('snippet');
var nconf = require('nconf');

var mongo = require('./mongo');
var utils = require('./utils');
var error = require('./error');

function updateMetadata(snippet, received) {
    return fs
        .readFileAsync('parsers/' + received.parserName + "-key.json")
        .then(JSON.parse)
        .then(function(fcontent) {
            if(fcontent.key !== received.parserKey)
                throw new Error(
                    "Invalid key supply for parser " + received.parserName);

            if(_.isUndefined(snippet.metadata))
                snippet.metadata = {};

            _.set(snippet.metadata, received.parserName, received.value);
            return _.omit(snippet, ['_id']);
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
    ret.repeat = ( _.get(body, 'repeat') === "true" );
    ret.amount = _.parseInt(_.get(body, 'amount'));

    if(_.isObject(requirements)) {
        ret.mongoQuery.metadata = requirements;
    }

    return ret;
};

function snippetQuery(selector) {
    return mongo.read(nconf.get('schema').htmls, selector, {});
};

function isValid(meta) {
    return !
        ( _.isUndefined(meta) || _.isNull(meta) || 
        ( _.isString(meta) && _.size(meta) === 0) );
};

/* first function called, to get the amount of snippet */
function snippetStatus(req) {
    var userReq = importSelector(req.body);
    return snippetQuery(userReq.mongoQuery)
        .then(function(content) {
            return _.reduce(content, function(memo, entry) {
                memo.available += 1;
                var meta = _.get(entry.metadata, userReq.parserName, null);
                if(isValid(meta)) {
                    memo.parsed += 1;
                }
                if(isValid(meta) && userReq.repeat === false) {
                    memo.available -= 1;
                }
                return memo;
            }, { available: 0, parsed: 0 });
        })
        .then(function(result) {
            debug("Status check result for %s: %d available %d parsed",
                userReq.parserName, result.available, result.parsed);
            return { json: result };
        });
};

/* second functon called, to get the actual snippet */
function snippetContent(req) {
    var userReq = importSelector(req.body);

    if(_.isNaN(userReq.amount) || _.isUndefined(userReq.amount))
        throw new Error(
            "required .amount in the request, define snippet received");

    return snippetQuery(userReq.mongoQuery)
        .then(function(content) {
            return _.reduce(content, function(memo, entry) {
                var snippet = null;
                var meta = _.get(entry.metadata, userReq.parserName, null);
                if(isValid(meta)) {
                    memo.parsed += 1;
                    if(userReq.repeat)
                        snippet = _.omit(entry, ['_id']);
                } else
                    snippet = _.omit(entry, ['_id']);

                if(_.size(memo.snippets) === userReq.amount) {
                    snippet = null;
                    memo.remaining += 1;
                }

                if(!_.isNull(snippet))
                    memo.snippets.push(snippet);

                return memo;
            }, {snippets: [], remaining: 0, parsed: 0} );
        })
        .then(function(result) {
            debug("Returned %d HTML snippets for %s, %d remaining, %d done",
                _.size(result.snippets), userReq.parserName,
                result.remaining, result.parsed);
            return { json: result };
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
    return snippetQuery({ 'id': received.htmlId }, {})
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
                    'metadata': updated.metadata,
                    'id': updated.htmlId
                }});
        })
        .catch(function(error) {
            debug("Error! %s", error);
            return { json: { 'error': error } };
        });
};

module.exports = {
    snippetStatus: snippetStatus,
    snippetContent: snippetContent,
    snippetResult: snippetResult
};
