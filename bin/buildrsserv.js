const Promise = require('bluebird');
const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('bin:buildrsserv');
const nconf= require('nconf');

const echoes = require('../lib/echoes');

nconf.argv().env().file({ file: 'config/content.json' });

/* configuration for elasticsearch */
echoes.addEcho("elasticsearch");
echoes.setDefaultEcho("elasticsearch");

const FREQUENCY = 5;
/*
 * This tool look at the `feeds` for object with { created: false },
 * and creates a populated XML newsfeed with the last days of matching 
 * keywords.
 * If success, mark the semantic with a new date, if fail, mark it with "false".
 */

const timeWindow = _.parseInt(nconf.get('window')) || 5; // minutes
var lastExecution = null;
/*
 * It looks at all the `labels` added since the lastExecution (and, if null
 * uses the default of the env variable "window", look if any feed match
 * with them, and update them if they do
 */

console.log(`Starting periodic check, every ${FREQUENCY} seconds`);
infiniteLoop();

function infiniteLoop() {
    /* this will launch other scheduled tasks too */
    return Promise
        .resolve()
        .delay(FREQUENCY * 1000)
        .then(getNewFeeds)
        .tap(logNewFeeds)
        .map(createNewFeed)
        .delay(FREQUENCY * 1000)
        .then(function() {

            if(lastExecution) {
                debug("Looking at labels updated in the last %s", moment.duration(moment() - lastExecution).humanize() );
            } else {
                debug("First execution! looking at labels since at %s, processing %d entries", moment().format(), _.size(entries) );
                lastExecution = moment().subtract(timeWindow, 'm');
            }

            return mongo
                .read(nconf.get('schema').labels, { when: { "$lt": new Date( lastExecution.format() ) }})

            lastExecution = moment();
            const limit = _.parseInt(nconf.get('limit'));

            if(!_.isNaN(limit) && limit < _.size(entries)) {
                debug("Process cap to %d requests, we had %d entries, cutting off %d",
                    limit, _.size(entries), _.size(entries) - limit);
                entries = _.slice(entries, 0, limit);
                debugger;
            }
            logSemanticServer(_.size(entries));
            return entries;
        })
        .map(semantic.buildText)
        .map(process, { concurrency: 1 })
        .then(_.compact)
        .tap(function(entries) {
            if(_.size(entries)) {
                debug("Completed %d entries succesfull", _.size(entries));
                lastExecution = moment();
            }
        })
        .then(infiniteLoop);
};


function getNewFeeds() {
    return mongo
        .read(nconf.get('schema').feeds, { created: false });
        
};

function logNewFeeds(feeds) {
    debug("I should log %d new feeds", _.size(feeds));
}

function createNewFeed(feed) {

    /* this function create the XML rss based on feed.labels */
    debug("%j", feed);

    mongo.readLimit(

};

function process(entry) {
    const token = nconf.get('token');
    return semantic
        .dandelion(token, entry.dandelion, entry.semanticId)
        .then(function(analyzed) {

            if(!analyzed)
                throw new Error();

            if(analyzed.headers['x-dl-units-left'] === 0) {
                debug("Units finished!");
                process.exit(1);
            }

            if(_.isUndefined(analyzed.lang))
                return semantic.updateMetadata(_.extend(entry, { semantic: null }) );

            return Promise.all([
                elasticLog(entry, analyzed),
                semantic.updateMetadata(_.extend(entry, { semantic: new Date() }) ),
                semantic.saveSemantic(analyzed.semantics),
                semantic.saveLabel(analyzed.label)
            ]);
        })
        .catch(function(error) {
            debug("Error with semanticId %s: %s", entry.semanticId, error);
            return semantic.updateMetadata(_.extend(entry, { semantic: false }) );
        });
};

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
