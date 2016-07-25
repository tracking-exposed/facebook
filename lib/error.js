var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('reportError');

module.exports = {
    reportError: function(errorInfo) {
        debug("%j", errorInfo);
    }
};

