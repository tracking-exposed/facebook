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
const max = new Date("2018-11-30");
const CHUNK = 100;

const since = nconf.get('since');
if(!since) {
    console.log("`since` variable is required");
    process.exit(1);
}
let last = new Date(since);
let total = null;

return mongo
    .readLimit(cName, {}, { impressionTime: -1 }, 1, 0)
    .then(_.first)
    .then(function(lastSaved) {
        if(lastSaved) {
            debug("Last reference found to %s", lastSaved.impressionTime);
            last = new Date(lastSaved.impressionTime);
        }
        else {
            debug("Starting `since` %s", last);
        }
        return last;
    })
    .tap(function(last) {
        return mongo.count(nconf.get('schema').htmls, {
                savingTime: { $gt: last, $lte: max }
        })
        .tap(function(amount) {
            debug("The amount of htmls between %s and %s is: %d", last, max, amount);
            total = amount;
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
            debug("%d seconds, Hours to do %d = %d",
                secs, total, _.round( ((secs * ( total / CHUNK )  ) / 3600), 1)
            );
            return new Date(_.last(elements).impressionTime);
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
        debug("Saving %d objects", _.size(copyable));
        if(_.size(copyable))
            return mongo.writeMany(cName, copyable);
    });
};

function enhanceRedact(e) {
    try {
        _.unset(e, '_id');
        e.impressionOrder = _.first(e.impressionOrder);
        e.impressionTime = new Date( _.first(e.impressionTime) );
        e.pseudo = utils.pseudonymizeUser(e.userId);
        const jsdom = new JSDOM(e.html).window.document;
        e.attributions = attributeOffsets(jsdom, e.html);
        e.details = l({jsdom}).linkedtime;
        _.unset(e, 'html');
    } catch(error) {
        console.error(error);
        return null;
    }
    return e;
};

function mongoPipeline(lastSaved) {

    return mongo.aggregate(nconf.get('schema').htmls, [{
        /* I use savingTime despite we use the impressionTime, because
         * savingTime is indexes, impressionTime ensure differencies */
            $match: {
                savingTime: { $gt: lastSaved, $lte: max }
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

