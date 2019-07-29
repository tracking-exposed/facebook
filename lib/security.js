
const nconf = require('nconf');
const params = require('./params');
const debug = require('debug')('lib:debug');

function checkPassword(req) {
    var key = params.getString(req, 'key');
    if( key !== nconf.get('key') ) {
        debug("Authentication failure, password mismatch");
        return false;
    }
    return true;
};

function checkKeyIsSet() {
    if(nconf.get('key') === 'invalid_default')
        throw new Error("key is set to be the default, this is not allowed");
    debug("password is set and it is not the default");
};


module.exports = {
    checkPassword,
    authError: { text: "Authentication Error" },
    checkKeyIsSet,
};
