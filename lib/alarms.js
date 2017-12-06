var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:alarm');
var nconf = require('nconf');
 
var mongo = require('./mongo');

/*
 * format of alarm info `alinfo`: {
 *      caller: <String>
 *      what: <String>
 *      info: <Object>
 * }
 * db.alarms.createIndex( { "when": 1 }, { expireAfterSeconds: 24 * 3600 } )
 */
function reportAlarm(alinfo) {

    debug("Received new %s %s, (info: %s)",
        alinfo.caller, alinfo.what, typeof alinfo.info);
    alinfo.when = new Date();
    return mongo
        .writeOne(nconf.get('schema').alarms, alinfo);
};

module.exports = {
    reportAlarm: reportAlarm
};
