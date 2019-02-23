const _ = require('lodash');
const nconf = require('nconf');
const Promise = require('bluebird');
const JSDOM = require('jsdom').JSDOM;
const debug = require('debug')('datathon');
const moment = require('moment');

const utils = require('../lib/utils');
const mongo = require('../lib/mongo');
const l = require('../parsers/components/linkontime');

const cfgFile = "config/content.json";
nconf.argv().env().file({ file: cfgFile });

const cName = 'finalized';
const CHUNK = nconf.get('amount') ? _.parseInt(nconf.get('amount')) : 500;

let max = null;
const until = nconf.get('unti');
if(!until) {
    max = new Date("2018-11-30");
    debug("`until` not set: using the default %s", max);
}
else {
    max = new Date(until);
    debug("`until` set, it will stop when reach %s", max);
}

const since = nconf.get('since');
let last = new Date(since);
let total = null;
let progressive = 0;
let initial = 0;
const executedAt = moment();

return mongo
    .readLimit(cName, {}, { savingTime: -1 }, 1, 0)
    .then(_.first)
    .then(function(lastSaved) {
        if(lastSaved) {
            if(since) {
                debug("Last reference found to %s but since %s request overrides",
                    lastSaved.savingTime, since);
                last = new Date(since);
            } else {
                debug("Last reference found to %s, and since not configured", lastSaved.savingTime);
                last = new Date(lastSaved.savingTime);
            }
        }
        else if(!since) {
            debug("When last reference don't exist, `since` is mandatory");
            process.exit(1);
        }
        else {
            last = new Date(since);
            debug("Starting `since` %s", last);
        }
        return last;
    })
    .tap(function(last) {
        return mongo.count(cName, {})
            .tap(function(before) {
                debug("previously found %d, chunk size configured (with `amount`) is %d", before, CHUNK);
                initial = before;
            });
    })
    .tap(function(last) {
        return mongo.count(nconf.get('schema').htmls, {
                savingTime: { $gt: last, $lte: max }
        })
        .tap(function(amount) {
            total = (amount - initial);
            debug("The # of htmls between %s and %s is: %d, still TBD %d",
                moment(last).format(), moment(max).format(), amount, total);
        });
    })
    .then(infiniteLoop);


function infiniteLoop(last) {
    let start = moment();
    return mongoPipeline(last)
        .map(enhanceRedact)
        .then(_.compact)
        .tap(massSave)
        .then(function(elements) {
            if(!_.size(elements)) {
                console.log("0 elements found");
                process.exit(1);
            }
            let end = moment();
            var secs = moment.duration(end - start).asSeconds();
            debug("exec %d secs 1st [%s] last [%s]",
                secs, 
                _.first(elements) ? moment(_.first(elements).savingTime).format() : "NONE",
                _.last(elements) ? moment(_.last(elements).savingTime).format() : "NONE"
            );
            return new Date(_.last(elements).savingTime);
        })
        .then(infiniteLoop)
        .catch(function(error) {
            console.log("Fatal");
            console.error(error);
        });
};

function massSave(elements) {
    let copyable = new Object(elements);
    return Promise.map(elements, function(e) {
        return mongo
            .count(cName, { id: e.id })
            .tap(function(a) {
                if(a > 0)
                    copyable = _.reject(copyable, { id: e.id });
            });
    }, { concurrency: 5 })
    .then(function() {
        progressive += _.size(copyable);
        const runfor = moment.duration(moment() - executedAt).asSeconds();
        const pps = _.round(progressive / runfor, 0)
        const estim = (total - progressive) / pps;
        const stillwaitfor = moment.duration({ seconds: estim }).humanize();
        debug("Saving %d objects, total %d (still TBD %d) run since %s (%d secs) PPS %d ETA %s",
            _.size(copyable), progressive, total - progressive,
            moment.duration(executedAt - moment()).humanize(),
            runfor, pps, stillwaitfor
        );
        if(_.size(copyable))
            return mongo.writeMany(cName, copyable);
    });
};

function enhanceRedact(e) {
    try {
        _.unset(e, '_id');
        e.impressionOrder = _.first(e.impressionOrder);
        e.impressionTime = _.first(e.impressionTime);
        e.pseudo = utils.pseudonymizeUser(e.userId);
        const jsdom = new JSDOM(e.html).window.document;
        e.attributions = attributeOffsets(jsdom, e.html);
        e.details = l({jsdom}).linkedtime;
        _.unset(e, 'html');
        _.unset(e, 'userId');
    } catch(error) {
        console.error(error);
        return null;
    }
    return e;
};

function mongoPipeline(lastSaved) {

    if(moment(lastSaved).isAfter(max)) {
        debug("Execution completed, reach %s", max);
        process.exit(1);
    }

    return mongo.aggregate(nconf.get('schema').htmls, [{
        /* I use savingTime despite we use the impressionTime, because
         * savingTime is indexes, impressionTime ensure differencies */
            $match: {
                savingTime: { $gt: lastSaved }
            }},
            { $sort: {
                savingTime: 1
            }},
            { $limit: CHUNK },
            { $lookup: {
                from: "impressions2",
                localField: "id",
                foreignField: "htmlId",
                as: "impre"
            }},
            { $project: {
                html: true,
                utype: true,
                permaLink: true,
                id: true,
                timelineId: true,
                userId: true,
                savingTime: true,

                impressionOrder: '$impre.impressionOrder',
                impressionTime: '$impre.impressionTime',
            }}
        ]);
};

function attributeOffsets(jsdom, htmlstring) {

    let retval = []
    // { h: 'h5' || 'h6', offset: <Int>, name: <String>, display: <String> }
    const h5s = jsdom.querySelectorAll('h5');
    const h6s = jsdom.querySelectorAll('h6');

    function finder(initialO, h) {
        let linked = h.firstChild && h.firstChild.querySelector && h.firstChild.querySelector('a');
        if(linked) {
            let name = h.firstChild.querySelector('a').textContent;
            let display = h.textContent;
            let offset = htmlstring.indexOf(h.outerHTML);
            if(name) {
                retval.push(_.extend(initialO, {
                    offset,
                    name,
                    display
                }));
            }
        }
    };

    _.each(h5s, _.partial(finder, { h: 'h5' }));
    _.each(h6s, _.partial(finder, { h: 'h6' }));

    return retval;
};

