const Promise = require('bluebird');
const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('bin:buildrsserv');
const nconf= require('nconf');
const path = require('path');
const fs = Promise.promisifyAll(require('fs'));
nconf.argv().env().file({ file: 'config/content.json' });

const utils = require('../lib/utils');
const echoes = require('../lib/echoes');
const mongo = require('../lib/mongo');
const rss = require('../lib/rss');

/* configuration for elasticsearch */
echoes.addEcho("elasticsearch");
echoes.setDefaultEcho("elasticsearch");

const FREQUENCY = 10;
const timeWindow = _.parseInt(nconf.get('window')) || 5; // minutes
var lastExecution = null;

console.log(`Starting periodic check, every ${FREQUENCY} seconds`);

function infiniteLoop() {
    /* this will launch other scheduled tasks too */
    return Promise
        .resolve()
        .delay(FREQUENCY * 1000)
        /*
         * This tool look at the `feeds` for object with { created: false },
         * and creates a populated XML newsfeed with the last days of matching 
         * keywords.
         * If success, mark the semantic with a new date, if fail, mark it with "false".
         */
        .then(function () {
            return mongo
                .read(nconf.get('schema').feeds, { created: false });
        })
        .map(rss.composeXMLfromFeed, { concurrency: 1 })
        .tap(logCreations)
        .delay(FREQUENCY * 1000)
        /*
         * It looks at all the `labels` added since the lastExecution (and, if null
         * uses the default of the env variable "window", look if any feed match
         * with them, and update them if they do
         */
        .then(function() {

            if(!lastExecution) {
                debug("First execution, looking at %d minutes back", timeWindow);
                lastExecution = moment().subtract(timeWindow, 'm').add(moment().utcOffset, 'm');
            }

            return rss.findMatchingFeeds(lastExecution)
                .map(rss.composeXMLfromFeed, { concurrency: 1 })
                .map(rss.saveRSSfile, { concurrency: 1 });

        })
        .tap(function() {
           debug("news+updates processed in %s", moment.duration(moment() - lastExecution).humanize() );
                lastExecution = moment().add(moment().utcOffset, 'm');
        })
        .then(infiniteLoop);
};

infiniteLoop();

function logCreations(infos) {
}

/*
function logSemanticServer(amount) {
echoes.echo({
index: 'semanticserv',
amount: amount
});
}

function elasticLog(entry, analyzed) {
    echoes.echo({
        index: 'semantics',
        semanticId: entry.semanticId,
        textsize: _.size(entry.dandelion.fulltext),
        annotations: _.size(analyzed.semantics),
        lang: analyzed.lang
    });
};
 */
