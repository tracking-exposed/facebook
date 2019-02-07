const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');
const debug = require('debug')('routes:summary');
const pug = require('pug');
const nconf = require('nconf');

const mongo = require('../lib/mongo');
const utils = require('../lib/utils');
const adopters = require('../lib/adopters');


function optionParsing(amountString) {
    const MAXOBJS = 200;
    try {
        const amount = _.parseInt(_.first(amountString.split('-')));
        const skip = _.parseInt(_.last(amountString.split('-')));
        if(!_.isNaN(amount) && !_.isNaN(skip))
            return {
                amount,
                skip
            };
    } catch(error) { }
    return {
        amount: MAXOBJS,
        skip: 0
    };
};

function page(req) {

    const { amount, skip } = optionParsing(null);
    debug("page request, amount %d skip %d", amount, skip);
    return adopters
        .validateToken(req.params.userToken)
        .tap(function(supporter) {
            if(!supporter)
                throw new Error("authentication fail");
        })
        .then(function(supporter) {
            debug("Composing summary page for supporter %s", supporter.pseudo);
            return mongo
                .readLimit(nconf.get('schema').summary, { user: supporter.pseudo },
                    { impressionTime: -1}, amount, skip)
                .then(function(summary) {
                    debug("retrived %d objects, with amount %d skip %d", _.size(summary), amount, skip);
                    return {
                        summary,
                        supporter,
                    };
                });
        })
        .then(function(data) {
            // TODO echoes
            debug("Data here, %d %d", _.size(data.summary), _.size(data.supporter));
            return { 
                'text': pug.compileFile( __dirname + '/../sections/personal/summary.pug', {
                    pretty: true,
                    debug: false
                })({
                    supporter: data.supporter,
                    summary: data.summary
                })
            };
        })
        .catch(function(e) {
            debug("page (error): %s", e);
            return {
                'text': 'Authentication Error!'
            };
        });

};

function data(req) {
    const { amount, skip } = optionParsing(req.params.amount);
    debug("data request, amount %d skip %d", amount, skip);
    return adopters
        .validateToken(req.params.userToken)
        .then(function(supporter) {
            return mongo
                .readLimit(nconf.get('schema').summary, { user: supporter.pseudo },
                    { impressionTime: -1}, amount, skip);
        })
        .then(function(data) {
            debug("retrived %d objects, with amount %d skip %d", _.size(data), amount, skip);
            return { json: data };
        })
        .catch(function(e) {
            debug("data (error): %s", e);
            return { 'text':  `error: ${e}` };
        });
};

function csv(req) {
    debug("CSV request, amount forced to 1000, skip 0");

    var keys = [ "type", "publicationTime", "postId", "permaLink", "author", "authorLink", "texts", "textlength", "impressionTime", "impressionOrder", "user", "timeline", "errors" ];

    return adopters
        .validateToken(req.params.userToken)
        .then(function(supporter) {
            return mongo
                .readLimit(nconf.get('schema').summary, { user: supporter.pseudo },
                    { impressionTime: -1}, 1000, 0);
        })
        .tap(function(amount) {
            debug("produced %d objects", _.size(amount));
        })
        .reduce(function(memo, entry, cnt) {
            if(!memo.init) {
                memo.csv = _.trim(JSON.stringify(keys), '][') + "\n";
                memo.init = true;
            }

            _.each(keys, function(k, i) {
                var swap;
                if(k === 'impressionTime' || k === 'publicationTime' ) {
                    swap = _.get(entry, k);
                    if(!(cnt % 30)) {
                        debug("sample %d: %s", cnt, moment(swap).toISOString());
                    }
                    swap = moment(swap).toISOString();
                } else if(k === 'texts') {
                    swap = _.join(
                        _.map(
                            _.get(entry, 'texts', []),
                            'text'
                        )
                        , " ↑ ");
                    debugger;
                } else {
                    swap = _.get(entry, k, "");
                    swap = _.replace(swap, /"/g, '〃');
                    swap = _.replace(swap, /'/g, '’');
                }
                memo.csv +=  '"' + swap + '"';
                if(!_.eq(i, _.size(keys) - 1))
                    memo.csv += ',';
            });
            memo.csv += "\n";
            return memo;

        }, { init: false, onlyValues: false, csv: "" })
        .then(function(structured) {
            debug("produced %d bytes", _.size(structured.csv));
            return {
                headers: { "Content-Type":
                                "csv/text",
                           "content-disposition":
                                "attachment; filename=summary.csv"
                },
                text: structured.csv,
            };
        })
        .catch(function(e) {
            debug("csv (error): %s", e);
            return { text:  `error: ${e}` };
        });
}

function metadata(req) {

    const { amount, skip } = optionParsing(req.params.amount);
    debug("metadata request, amount %d skip %d", amount, skip);
    return adopters
        .validateToken(req.params.userToken)
        .then(function(supporter) {
            return mongo
                .readLimit(nconf.get('schema').metadata, { userId: supporter.userId },
                    { impressionTime: -1}, amount, skip);
        })
        .then(function(data) {
            debug("retrived %d objects, with amount %d skip %d", _.size(data), amount, skip);
            return { json: data };
        })
        .catch(function(e) {
            debug("data (error): %s", e);
            return { 'text':  `error: ${e}` };
        });
};

function extended(req) {
    debugger;
};


function semantics(req) {
    debugger;
};

module.exports = {
    page: page,
    data: data,
    metadata: metadata,
    csv: csv,
    extended: extended,
    semantics: semantics
};
