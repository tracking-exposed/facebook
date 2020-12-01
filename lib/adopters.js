const debug = require('debug')('lib:adopters');
const _ = require('lodash');
const moment = require('moment');
const nconf = require('nconf');

const mongo = require('./mongo');
const utils = require('../lib/utils');

const requiredHeaders =  {
    'content-length': 'length',
    'x-fbtrex-build': 'build',
    'x-fbtrex-version': 'version',
    'x-fbtrex-userid': 'supporterId',
    'x-fbtrex-publickey': 'publickey',
    'x-fbtrex-signature': 'signature',
    'x-iodcnl': 'paadc',
};

function processHeaders(received) {
    var ret = {};
    var errs = _.map(requiredHeaders, function(destkey, headerName) {
        var r = _.get(received, headerName);
        if(_.isUndefined(r))
            return headerName;

        _.set(ret, destkey, r);
        return null;
    });
    errs = _.compact(errs);
    return _.size(errs) ? { errors: errs } : ret;
};

function create(headers) {
    // when this function is called we are sure the 
    // combo 'userId'+'publicKey' do not exists

    if(_.isNaN(_.parseInt(headers.supporterId)))
        throw new Error("Invalid supporterId in headers");

    var supporter = {
        publicKey: headers.publickey,
        keyTime: new Date(),
        lastActivity: new Date(),
        version: headers.version,
        paadc: headers.paadc,
    };
    supporter.userId =  _.parseInt(headers.supporterId);
    supporter.pseudo = utils.pseudonymizeUser(supporter.userId);
    supporter.userSecret = utils.hash({
        publicKey: supporter.publicKey,
        random: _.random(0, supporter.userId),
        when: moment().toISOString()
    });
    debug("Creating %s %s (%d) %s", supporter.pseudo, supporter.publicKey, supporter.userId, supporter.paadc);
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
    processHeaders,
};
