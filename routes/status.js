const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');
const debug = require('debug')('routes:status');
const nconf = require('nconf');

const mongo = require('../lib/mongo');

function databaseStatus(req) {

    debug("databaseStatus :(");
    return {
        'json': {
            'not implemented': true
        }
    };
};

module.exports = {
    databaseStatus: databaseStatus,
};
