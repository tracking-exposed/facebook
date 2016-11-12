var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('snippet');
var nconf = require('nconf');

var mongo = require('./mongo');
var utils = require('./utils');
var error = require('./error');

/* this will be moved in config and kept secret */
var parserKeys = {
  'postType': [
      "msddskcsdfpsdfdskfopdskfopsdfpodk",
      "434343240932kklmk3m2m423l4mlk324c"
  ],
  'postTime': [
      "cklckldskl43r4k3lkm34klmk43klfkcc",
      "mkl9mjk9m879m87m9lk7mbhbh543bftyc"
  ]
};

function validParser(parserName) {
    var check = _.reduce(parserKeys, function(found, keys, name) {
        if(name === parserName)
            found = true;
        return found;
    }, null);
    if(_.isNull(check))
        throw new Error("parserName not found");
};

function importSelector(body) {
    /* sanitize the request and shape in the proper selector */
    var since = _.get(body, 'since');
    var until = _.get(body, 'until');
    var repeat = _.get(body, 'repeat');
    var parserName = _.get(body, 'parserName');
    var requirements = _.get(body, 'requirements');
    var amount = _.get(body, 'amount');

    debug("since %s until %s repead %s parser %s requirements %j",
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
    ret.parserName = validParser(parserName);
    ret.amount = _.parseInt(amount);

    return ret;
};

function snippetQuery(selector) {
    return mongo.read(nconf.get('schema').htmls, selector, {});
};

/* first function called, to get the amount of snippet */
function snippetStatus(req) {
    var userReq = importSelector(req.body);
    return snippetQuery(userReq.selector)
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
    debug("working with %s", JSON.stringify(userReq, undefined, 2));
    if(_.isNaN(userReq.amount) || _.isUndefined(userReq.amount))
        throw new Error(
            "required .amount in the request, define snippet received");
    return snippetQuery(userReq.selector)
        .then(function(content) {
            return _.reduce(content, function(memo, entry) {
                var snippet = null;
                if(_.isNull(entry.html))
                    return memo;
                var x =_.find(entry.metadata,{'name':userReq.parserName});
                if(_.isUndefined(x)) {
                    debug("undef");
                    snippet = _.omit(entry, ['_id']);
                } else if(userReq.repeat) {
                    debug("c'è qualcosa, ma c'è repeat");
                    snippet = _.omit(entry, ['_id']);
                } else {
                    debug("già processato, skip");
                }

                if(_.size(memo.snippets) === userReq.amount) {
                    snippet = null;
                    memo.remaining += 1;
                    debug("skip but remain++ %d", memo.remaining);
                }

                if(!_.isNull(snippet))
                    memo.snippets.push(snippet);

                debug("current size of memo.snippets %d",
                    _.size(memo.snippets));
                return memo;
            }, {snippets: [], remaining: 0} );
        })
        .then(function(result) {
            return { json: result };
        });
};

/* third function, to commit the snippet */
function snippetResult(req) {
    // todo commit the results
    debug("Received: %j", req.body);
    return { json: 'dummy OK' };
};

module.exports = {
    snippetStatus: snippetStatus,
    snippetContent: snippetContent,
    snippetResult: snippetResult
};
