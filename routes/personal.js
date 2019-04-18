const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');
const debug = require('debug')('routes:summary');
const pug = require('pug');
const nconf = require('nconf');

const mongo = require('../lib/mongo');
const params = require('../lib/params');
const adopters = require('../lib/adopters');

function summary(req) {
    const { amount, skip } = params.optionParsing(req.params.paging, 200);
    debug("summary request, amount %d skip %d", amount, skip);
    return adopters
        .validateToken(req.params.userToken)
        .then(function(supporter) {
            return mongo
                .readLimit(nconf.get('schema').summary, { user: supporter.pseudo },
                    { impressionTime: -1}, amount, skip);
        })
        .map(function(e) {
            return _.omit(e, ['_id', 'id' ]);
        })
        .then(function(data) {
            debug("retrived %d objects, with amount %d skip %d", _.size(data), amount, skip);
            return { json: data };
        })
        .catch(function(e) {
            debug("data (error): %s", e);
            return { 'text': `error: ${e}` };
        });
};

function csv(req) {
    const { amount, skip } = params.optionParsing(req.params.paging, 1000);
    debug("CSV request, amount forced to 1000, skip 0");

    var keys = [ "nature", "publicationTime", "postId", "permaLink", "fblinktype", "source", "sourceLink", "displaySource", "textsize", "texts", "impressionTime", "impressionOrder", "user", "timeline", "semanticId" ];

    return adopters
        .validateToken(req.params.userToken)
        .then(function(supporter) {
            return mongo
                .readLimit(nconf.get('schema').summary, { user: supporter.pseudo },
                    { impressionTime: -1}, amount, skip);
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
                    swap = moment(swap).toISOString();
                } else if(k === 'texts') {
                    swap = _.join(
                        _.map(
                            _.get(entry, 'texts', []),
                            'text'
                        )
                        , " ‖▩‖ ");
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
            return { text: `error: ${e}` };
        });
}

function metadata(req) {

    throw new Error("NIATM");
    // not implemented an endpoint, at the moment

    const { amount, skip } = params.optionParsing(req.params.paging);
    debug("metadata request: %d skip %d", amount, skip);
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

function semantics(req) {
    const { amount, skip } = params.optionParsing(req.params.paging);
    debug("semantics request: %d, skip %d", amount, skip);
    return adopters
        .validateToken(req.params.userToken)
        .then(function(supporter) {
            let ma = { $match: { user: supporter.pseudo } };
            let li = { $limit: (amount * 2) };
            let so = { $sort: { impressionTime: -1 } };
            let lo = { $lookup: {
                from: 'labels',
                localField: 'semanticId',
                foreignField: 'semanticId',
                as: 'labelcopy'
            } };
            return mongo
                .aggregate(nconf.get('schema').summary, [ ma, li, so, lo ])
        })
        .map(function(e) {
            if(_.size(e.labelcopy)) {
                e.labels = _.get(e.labelcopy[0], 'l');
                e.lang = _.get(e.labelcopy[0], 'lang');
            }
            return _.omit(e, ['_id', 'id', 'labelcopy' ]);
        })
        .then(function(prod) {
            return { json: prod };
        });
};

function personStats(req) {
    throw new Error("NIATM");
    // not implemented an endpoint, at the moment

    /* this should return the same of summary, but generate this:
     * https://github.com/tracking-exposed/facebook/issues/117 */
};

module.exports = {
    summary: summary,
    metadata: metadata,
    csv: csv,
    semantics: semantics,
    personStats: personStats
};
