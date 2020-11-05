#!/usr/bin/env node
const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('fbtrex:parserv3');
const debuge = require('debug')('fbtrex:parserv3:error');
const overflowReport = require('debug')('fbtrex:OVERFLOW');
const nconf = require('nconf');

/* this library has the function to remotely fetch original HTML from server if an id it is specify */
const glue = require('../lib/glue');
/* pchain is the utility modeuly for the parser chain */
const pchain = require('../lib/parserchain');
/* dissector are all the individual metadata miner */
const dissector = require('../parsers/sequence');

nconf.argv().env().file({ file: 'config/content.json' });

/*
     return glue.retrive(htmlfilter)
                .then(glue.writers)
                .tap(function(x) {
                    if(x && x[2] && htmlfilter.id == x[2][0].id)
                        debug("Successfully retrived remote content");
                    else
                        debug("Failure in retriving remote content!");
                })
*/

async function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}

const FREQUENCY = 10;
const AMOUNT_DEFAULT = 20;
const BACKINTIMEDEFAULT = 3;

let htmlAmount = _.parseInt(nconf.get('amount')) ? _.parseInt(nconf.get('amount')) : AMOUNT_DEFAULT;

const stop = _.parseInt(nconf.get('stop')) ? _.parseInt(nconf.get('stop')) : 0;
const backInTime = _.parseInt(nconf.get('minutesago')) ? _.parseInt(nconf.get('minutesago')) : BACKINTIMEDEFAULT;
const id = nconf.get('id');
const filter = nconf.get('filter') ? JSON.parse(fs.readFileSync(nconf.get('filter'))) : null;
const singleUse = !!id;
const repeat = !!nconf.get('repeat');

let nodatacounter = 0;
let processedCounter = 0;
let lastExecution = moment().subtract(backInTime, 'minutes').toISOString();
let computedFrequency = 10;
const stats = { lastamount: null, currentamount: null, last: null, current: null };

function pipeline(e) {
    try {
        debug("#%d\ton (%d minutes ago) %s",
            processedCounter,
            _.round(moment.duration( moment() - moment(e.html.savingTime)).asMinutes(), 0),
            e.html.id);
        processedCounter++;
        pchain.cleanLog();
        debugger;
        const rv = _.reduce(dissector.dissectorList, function(memo, extractorName) {
            try {
                let mined = pchain.wrapDissector(
                    _.get(dissector, extractorName), extractorName, e
                );
                _.set(memo.findings, extractorName, mined);
            } catch(error) {
                _.set(memo.failures, extractorName, error.message);
            }
            return memo;
        }, {
            failures: {},
            source: e,
            findings: {}
        });
        debug("🡆🡆 http://localhost:1313/debug/html/#%s %s", e.html.id, pchain.logMessage());
        return rv;
    } catch(error) {
        debuge("#%d\t pipeline general failure error: %s", processedCounter, error.message);
        return null;
    }
}

async function executeParsingChain(htmlFilter) {
    debug("Fetching html...");

    const envelops = await pchain.getLastHTMLs(htmlFilter, htmlAmount);

    if(!_.size(envelops.sources)) {

        debug("no data");
        nodatacounter++;
        if( (nodatacounter % 10) == 1) {
            debug("%d no data at the last query: %j %j",
                nodatacounter, _.keys(htmlFilter), htmlFilter.savingTime);
        }
        lastExecution = moment().subtract(2, 'm').toISOString();
        computedFrequency = FREQUENCY;
        return;
    } else {
        debug("yes data, no sleep");
        computedFrequency = 0.1;
    }

    if(!envelops.overflow) {
        lastExecution = moment().subtract(BACKINTIMEDEFAULT, 'm').toISOString();
        /* 1 minute is the average stop, so it comeback to check 3 minutes before */
        overflowReport("<NOT>\t\t%d documents", _.size(envelops.sources));
    }
    else {
        lastExecution = moment( _.last(envelops.sources).html.savingTime );
        overflowReport("first %s (on %d) <last +minutes %d> next filter set to %s",
            _.first(envelops.sources).html.savingTime, _.size(envelops.source),
            _.round(moment.duration(
                moment( _.last(envelops.sources).html.savingTime ) - moment(_.first(envelops.sources).html.savingTime )
            ).asMinutes(), 1),
            lastExecution);
    }

    if(stats.currentamount || stats.lastamount)
        debug("[+] %d htmls in new parsing sequences. (previous %d took: %s) and now process %d htmls",
            processedCounter, stats.currentamount, stats.lastamount,
            moment.duration(moment() - stats.current).humanize(),
            _.size(envelops.sources));

    stats.last = stats.current;
    stats.current = moment();
    stats.lastamount = stats.currentamount;
    stats.currentamount = _.size(envelops.sources);

    const results = _.map(envelops.sources, pipeline);
    /* results is a list of objects: [ {
        source: { timeline, impression, dom, html },
        findings: { $dissector1, $dissector2 },
        failures: { $dissectorN, $dissectorX }
    } ] */

    throw new Error("trump");

    const updates = [];
    for (const entry of _.compact(analysis)) {
        let r = await automo.updateMetadata(entry[0], entry[1], repeat);
        updates.push(r);
    }
    debug("%d html.content, %d analysis, compacted %d, effects: %j",
        _.size(htmls.content), _.size(analysis),
        _.size(_.compact(analysis)), _.countBy(updates, 'what'));

    /* reset no-data-counter if data has been sucessfully processed */
    if(_.size(_.compact(analysis)))
        nodatacounter = 0;

    /* also the HTML cutted off the pipeline, the many skipped
     * by _.compact all the null in the lists, should be marked as processed */
    const remaining = _.reduce(_.compact(analysis), function(memo, blob) {
        return _.reject(memo, { id: blob[0].id });
    }, htmls.content);

    debug("Usable HTMLs %d/%d - marking as processed the useless %d HTMLs\t\t(sleep %d)",
        _.size(_.compact(analysis)), _.size(htmls.content), _.size(remaining), computedFrequency);

    const rv = await automo.markHTMLsUnprocessable(remaining);
    debug("%d completed, took %d secs = %d mins",
        processedCounter, moment.duration(moment() - stats.current).asSeconds(),
        _.round(moment.duration(moment() - stats.current).asMinutes(), 2));
    return rv;
}

async function recursiveCalling(actualRepeat) {
    try {
        let htmlFilter = {
            savingTime: {
                $gt: new Date(lastExecution),
            },
        };
        if(!actualRepeat)
            htmlFilter.processed = { $exists: false };

        if(filter)
            htmlFilter.id = { '$in': filter };
        if(id) {
            debug("Targeting a specific metadataId");
            htmlFilter = {
                metadataId: id
            }
        }

        if(stop && stop <= processedCounter) {
            console.log("Reached configured limit of ", stop, "( processed:", processedCounter, ")");
            process.exit(processedCounter);
        }

        await executeParsingChain(htmlFilter);
    } catch(e) {
        console.log("Error in filterChecker", e.message, e.stack);
    }
    if(singleUse) {
        debug("Single execution done!")
        process.exit(0);
    }
    await sleep(computedFrequency * 1000)
    await recursiveCalling(actualRepeat);
}

/* application starts here */
try {
    if(filter && id)
        throw new Error("Invalid combo, you can't use --filter and --id");

    if( id && (htmlAmount != AMOUNT_DEFAULT) )
        debug("Ignoring --amount because of --id");

    if(stop && htmlAmount > stop ) {
        htmlAmount = stop;
        debug("--stop %d imply --amount %d", stop, htmlAmount);
    }

    let actualRepeat = (repeat || !!id || !!filter || (backInTime != BACKINTIMEDEFAULT) );
    if(actualRepeat != repeat)
        debug("--repeat it is implicit!");

    /* this is the begin of the parsing core pipeline.
     * gets htmls from the db, if --repeat 1 then previously-analyzed-HTMLS would be
     * re-analyzed. otherwise, the default, is to skip those and wait for new 
     * htmls. To receive htmls you should have a producer consistend with the 
     * browser extension format, and bin/server listening 
     * 
     * This script pipeline might optionally start from the past, and 
     * re-analyze HTMLs based on --minutesago <number> option.
     * 
     * At the end update metadata only if meaningful update is present,
     * you might notice the library calls in automo, they should be refactored
     * and optimized.
     * */

    /* which is an async function */
    recursiveCalling(actualRepeat);

} catch(e) {
    console.log("Error in wrapperLoop", e.message);
}
