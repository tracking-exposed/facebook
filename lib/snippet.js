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
    var repeat = _.get(body, 'repeat');
    var parserName = _.get(body, 'parserName');
    var requirements = _.get(body, 'requirements');
    var amount = _.get(body, 'amount');

    debug("・Selector・since %s until %s repead %s parser %s requirements %j",
        since, until, repeat, parserName, requirements);

    var ret = {
      "mongoQuery" : {
        "writingTime" : {
            "$gt": new Date(since),
            "$lt": new Date(until)
        },
      }
    };

    ret.repeat = (repeat === true);
    ret.parserName = parserName;
    ret.amount = _.parseInt(amount);

    return ret;
};

function snippetQuery(selector) {
    return mongo.read(nconf.get('schema').htmls, selector, {});
};

/* first function called, to get the amount of snippet */
function snippetStatus(req) {
    var userReq = importSelector(req.body);
    return snippetQuery(userReq.mongoQuery)
        .then(function(content) {
            /* parserName or repeat is managed here */
            return _.reduce(content, function(memo, entry) {
                if(_.isNull(entry.html)) {
                    return memo;
                }
                if(userReq.repeat) {
                    memo.available += 1;
                    memo.parsed += 1;
                    return memo;
                } 
                memo.available += 1;
                if(_.isUndefined(entry.metadata)) {
                    return memo;
                }
                var x =_.find(entry.metadata,{'name':userReq.parserName});
                if(!_.isUndefined(x)) {
                    memo.parsed += 1;
                }
                return memo;
            }, { available: 0, parsed: 0 });
        })
        .then(function(result) {
            return { json: result };
        });
};

/* second functon called, to get the actual snippet */
function snippetContent(req) {
    var userReq = importSelector(req.body);
    debug("Requested content of %d snippets by %s (repeat %s)",
        userReq.amount, userReq.parserName, userReq.repeat);

    if(_.isNaN(userReq.amount) || _.isUndefined(userReq.amount))
        throw new Error(
            "required .amount in the request, define snippet received");

    return snippetQuery(userReq.mongoQuery)
        .then(function(content) {
            return _.reduce(content, function(memo, entry) {
                var snippet = null;
                if(_.isNull(entry.html))
                    return memo;
                var x = _.get(entry.metadata, userReq.parserName);
                if(_.isUndefined(x)) {
                    snippet = _.omit(entry, ['_id']);
                } else if(userReq.repeat) {
                    snippet = _.omit(entry, ['_id']);
                }

                if(_.size(memo.snippets) === userReq.amount) {
                    snippet = null;
                    memo.remaining += 1;
                }

                if(!_.isNull(snippet))
                    memo.snippets.push(snippet);

                return memo;
            }, {snippets: [], remaining: 0} );
        })
        .then(function(result) {
            return { json: result };
        });
};

function keysNotInit() {
    return (_.isUndefined(process.env.keys) ||
            _.isUndefined(process.env.keys[parserName]) );
}

/* third function, to commit the snippet */
function snippetResult(req) {
    var received = {
        htmlId: _.get(req.body, 'snippetId'),
        parserKey: _.get(req.body, 'parserKey'),
        value: _.first(_.values(_.get(req.body, 'metadata'))),
        parserName: _.first(_.keys(_.get(req.body, 'metadata'))),
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
