const debug = require('debug')('lib:adopters');
const _ = require('lodash');
const moment = require('moment');
const nconf = require('nconf');

const mongo = require('./mongo');
const utils = require('../lib/utils');

function create(headers) {
    // when this function is called we are sure the
    // combo 'userId'+'publicKey' do not exists

    if (_.isNaN(_.parseInt(headers['x-fbtrex-userid'])))
        throw new Error('Invalid userId in headers: ' + headers['x-fbtrex-userid']);

    var supporter = {
        publicKey: headers.publickey,
        keyTime: new Date(),
        lastActivity: new Date(),
        version: headers.version
    };
    supporter.userId = _.parseInt(headers['x-fbtrex-userid']);
    supporter.pseudo = utils.pseudonymizeUser(supporter.userId);
    supporter.userSecret = utils.hash({
        publicKey: supporter.publicKey,
        random: _.random(0, supporter.userId),
        when: moment().toISOString()
    });
    debug('Creating %s (%d)', supporter.pseudo, supporter.userId);
    return mongo
        .writeOne(nconf.get('schema').supporters, supporter)
        .return(supporter);
}

function validateToken(userToken) {
    return mongo
        .read(nconf.get('schema').supporters, {
            userSecret: userToken
        })
        .tap(function(x) {
            if(_.size(x) > 1)
                debug("Warning! duplicated userSecret!? %s", userToken);
        })
        .then(_.first)
        .then(function(supporter) {
            if(supporter && _.size(supporter.userSecret)) {
                return supporter;
            } else {
                debug("Authentication error: token not found");
                throw new Error("Authentication failure");
            }
        });
}

module.exports = {
    create: create,
    validateToken: validateToken,
};
