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

/* this is just for logging */
var lastExecution = null;
const FREQUENCY = 5;

/*
 * this tool look at the `metadata` for object with { semantic: true },
 * do the semantic analysis with dandelion.
 * If success, mark the semantic with a new date, if fail, mark it with "false".
 */

console.log(`Starting periodic check, every ${FREQUENCY} seconds`);
infiniteLoop();

function infiniteLoop() {
    /* this will launch other scheduled tasks too */
    return Promise
        .resolve()
        .delay(FREQUENCY * 1000)
        .then(semantic.getSemantic)
        .tap(function(entries) {

            if(!_.size(entries))
                return [];

            if(lastExecution)
                debug("New iteration after %s (%d entries)",
                    moment.duration(moment() - lastExecution).humanize(), _.size(entries) );
            else
                debug("First execution at %s (%d entries)", moment().format(), _.size(entries) );

            lastExecution = moment();
        })
        /* TODO dividi in chunk of rischi di avere milioni di roba e mai un update su metadata */
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

function process(entry) {
    const token = nconf.get('token');
    return semantic
        .dandelion(token, entry.dandelion, entry.semanticId)
        .then(function(analyzed) {

            if(!analyzed)
                return;

            return Promise.all([
                elasticLog(entry, analyzed),
                semantic.updateMetadata(_.extend(entry, { semantic: new Date() }) ),
                semantic.saveSemantic(analyzed.semantics),
                semantic.saveLabels(analyzed.labels)
            ]);
        })
        .catch(function(error) {
            debug("Error with semanticId %s: %s", entry.semanticId, error);
            return semantic.updateMetadata(_.extend(entry, { semantic: false }) );
        });
};

function elasticLog(entry, analyzed) {
    // debug("logga");
    // echoes.echo({ });
};
