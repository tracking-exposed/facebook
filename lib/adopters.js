const debug = require('debug')('lib:supporters');
const _ = require('lodash');
const moment = require('moment');

const mongo = require('./mongo');
const utils = require('../lib/utils');

function create(headers) {
    // when this function is called we are sure the 
    // user do not exists

    if(_.isNaN(_.parseInt(headers.supporterId)))
        throw new Error("Invalid supporterId in headers");

    var supporter = {
        publicKey: headers.publickey,
        keyTime: new Date(),
        lastActivity: new Date(),
        version: headers.version
    };
    supporter.userId =  _.parseInt(headers.supporterId);
    supporter.pseudo = utils.pseudonymizeUser(supporter.userId);
    supporter.userSecret = utils.hash({
        publicKey: supporter.publicKey,
        random: _.random(0, supporter.userId),
        when: moment().toISOString()
    });
    debug("Creating %s (%d)", supporter.pseudo, supporter.userId);
    return mongo
        .writeOne(nconf.get('schema').supporters, supporter)
        .return(supporter);
}

module.exports = {
    create: create
};
