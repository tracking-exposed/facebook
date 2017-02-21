var _ = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var moment = require('moment');
var debug = require('debug')('lib:parser');
var nconf = require('nconf');

var mongo = require('./mongo');
var utils = require('./utils');

function updateMetadata(snippet, received) {
    return fs
        .readFileAsync("parsers/parsers-keys.json")
        .then(JSON.parse)
        .then(function(fcontent) {
            return _.find(fcontent, {name: received.parserName});
        })
        .then(function(fcontent) {
            if(fcontent.key !== received.parserKey)
                throw new Error(
                    "Invalid key supply for parser " + received.parserName);

            var sanitized = _.reduce(received.fields, function(memo, f) {
                if(_.gte(fcontent.fields.indexOf(f), 0)) {
                    var value = received.metadata[f];
                    if(_.isUndefined(value))
                        debug("field %s declared but not found", f);
                    else if(value === "true")
                        value = true;
                    else if(value === "false")
                        value = false

                    /* other special checks can be put here */
                    memo[f] = value;
                } else {
                    debug("Unauthorized field %s for %s: IGNORED",
                        f, fcontent.name);
                }
                return memo;
            }, {});
            return _.omit( _.extend(snippet, sanitized), ['_id']);
        });
};

function importSelector(body) {
    /* "sanitize" the request and shape in the proper mongo selector */
    var since = _.get(body, 'since');
    var until = _.get(body, 'until');
    var requirements = _.get(body, 'requirements');
    var ret = {};

    ret.parserName = _.get(body, 'parserName');

    /* The drama about nested boolean in JSON become strings. */
    ret.mongoQuery = _.reduce(requirements, function(memo, value, key) {

        if(ret.parserName === key)
            value = { '$exists': value[ret.parserName] === 'true' };

        _.set(memo, key, value);
        return memo;
    }, {});

    ret.mongoQuery.savingTime = {
        "$gt": new Date(since),
        "$lt": new Date(until)
    };

    // debug("Parser %s query %s", ret.parserName, JSON.stringify(ret.mongoQuery, undefined, 2));
    return ret;
};

/* first function called, to get the amount of snippet */
function snippetAvailable(req) {
    debug("This would be discontinued!!");
    var userReq = importSelector(req.body);
    return mongo
        .countByMatch(nconf.get('schema').htmls, userReq.mongoQuery)
        .then(function(result) {
            debug("Status check result for %s: %d HTMLs",
                userReq.parserName, result);
            return { json: {
              'available': result,
              'limit': nconf.get('htmlMaxAmount')
            }};
        });
};

/* second functon called, to get the actual snippet */
function snippetContent(req) {
    var userReq = importSelector(req.body);

    return mongo
        .readLimit(nconf.get('schema').htmls, userReq.mongoQuery,
                   { "savingTime": -1 }, nconf.get('htmlMaxAmount'), 0)
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
    var received = _.pick(req.body, [ 'htmlId', 'parserKey',
                          'metadata', 'fields', 'parserName']);

    debug("Check, received metadata: %j", received);
    return mongo
        .read(nconf.get('schema').htmls, { 'id': received.htmlId })
        .then(function(snippet) {
            return updateMetadata(_.first(snippet), received);
        })
        .then(function(updated) {
            return mongo
                .updateOne(
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
