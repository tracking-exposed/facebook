var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:accesslog');
var nconf = require('nconf');

var mongo = require('./mongo');
var utils = require('./utils');

function accesslog(request, details) {
    var sourceIP = _.get(request.headers, "x-forwarded-for");
    var geoinfo = utils.getGeoIP(sourceIP);
    var accessInfo = {
        when: new Date(moment().toISOString()),
        ccode: geoinfo.code,
        referer: request.headers.referer,
        details: details
    };

    return mongo
        .writeOne(nconf.get('schema').accesses, accessInfo);
};

module.exports = accesslog;
