const Promise = require('bluebird');
const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('bin:semanticserv');
const nconf= require('nconf');

const echoes = require('../lib/echoes');
const semantic = require('../lib/semantic');

nconf.argv().env().file({ file: 'config/content.json' });

/* configuration for elasticsearch */
echoes.addEcho("elasticsearch");
echoes.setDefaultEcho("elasticsearch");

/* this software executes every $FREQUENCY seconds + the time it took */
const FREQUENCY = 5;
/* this is just for logging when has been the last exectuion, it might take hours */
var lastExecution = null;

/*
 * this tool look at the `metadata` for object with { semantic: true },
 * do the semantic analysis with dandelion.
 * If success, mark the semantic with a new date, if fail, mark it with "false".
 */

console.log(`Checking periodically every ${FREQUENCY} seconds...`);
infiniteLoop();

function infiniteLoop() {
    /* this will launch other scheduled tasks too */
    return Promise
        .resolve()
        .delay(FREQUENCY * 1000)
        .then(semantic.getSemantic)
        .then(function(entries) {

            if(!_.size(entries))
                return [];

            if(lastExecution)
                debug("New iteration after %s, processing %d entries",
                    moment.duration(moment() - lastExecution).humanize(), _.size(entries) );
            else
                debug("First execution at %s, processing %d entries", moment().format(), _.size(entries) );

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

function process(entry) {
    const token = nconf.get('token');
    return semantic
        .dandelion(token, entry.fulltext, entry.semanticId)
        .then(function(analyzed) {

            if(!analyzed || !analyzed.semanticId)
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
