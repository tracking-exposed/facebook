const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');
const debug = require('debug')('routes:summary');
const pug = require('pug');
const nconf = require('nconf');

const mongo = require('../lib/mongo');
const params = require('../lib/params');
const utils = require('../lib/utils');
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

function produceCSVv1(entries) {

    const keys = [ "impressionTime", "impressionOrder","user",
        "timeline","publicationTime","postId","nature","fblinktype",
        "permaLink","source","sourceLink","displaySource","textSize",
        "LIKE","LOVE","ANGRY","HAHA","WOW","SAD","images.count","id" ];

    let produced = _.reduce(entries, function(memo, entry, cnt) {
        if(!memo.init) {
            memo.csv = _.trim(JSON.stringify(keys), '][') + "\n";
            memo.init = true;
        }

        _.each(keys, function(k, i) {
            let swap = _.get(entry, k, "");
            if(k == 'impressionTime' || k == 'publicationTime' )
                memo.csv += moment(swap).toISOString();
            else if(_.isInteger(swap))
                memo.csv += swap;
            else {
                swap = _.replace(swap, /"/g, '〃');
                swap = _.replace(swap, /'/g, '’');
                memo.csv +=  '"' + swap + '"';
            }
            if(!_.eq(i, _.size(keys) - 1))
                memo.csv += ',';
        });
        memo.csv += "\n";
        return memo;

    }, { init: false, csv: "" });
    return produced.csv;
}

function personalCSV(req) {
    const { amount, skip } = params.optionParsing(req.params.paging, 1000);

    debug("CSV request by [%s], amount %d skip %d", req.params.userToken, amount, skip);

    return adopters
        .validateToken(req.params.userToken)
        .then(function(supporter) {
            return mongo
                .readLimit(nconf.get('schema').summary, { user: supporter.pseudo },
                    { impressionTime: -1}, amount, skip);
        })
        .tap(function(check) {
            if(!_.size(check)) throw new Error("Invalid token");
        })
        .then(produceCSVv1)
        .then(function(structured) {
            debug("personalCSV produced %d bytes", _.size(structured));
            const fname=`summary-${skip}-${amount}.csv`;
            return {
                headers: { "Content-Type": "csv/text",
                           "content-disposition": `attachment; filename=${fname}` },
                text: structured,
            };
        })
        .catch(function(e) {
            debug("csv (error): %s", e);
            return { text: `error: ${e}` };
        });
}

function timelineCSV(req) {
    const timelineId = req.params.timelineId;
    const timelineP = utils.pseudonymizeTmln(timelineId);

    debug("timeline CSV request (Id %s -> p %s)", timelineId, timelineP);

    return mongo
        .read(nconf.get('schema').summary, { timeline: timelineP }, { impressionTime: -1})
        .then(produceCSVv1)
        .tap(function(check) {
            if(!_.size(check)) throw new Error("Invalid timelineId");
        })
        .then(function(structured) {
            debug("timelineCSV produced %d bytes", _.size(structured));
            const fname=`timeline-${timelineP}.csv`;
            return {
                headers: { "Content-Type": "csv/text",
                           "content-disposition": `attachment; filename=${fname}` },
                text: structured,
            };
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
            return { 'text': `error: ${e}` };
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
    personalCSV,
    timelineCSV,
    semantics: semantics,
    personStats: personStats
};
