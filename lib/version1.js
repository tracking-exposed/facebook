var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('api-1');
var geoip = require('geoip-native');
var jade = require('jade');

var mongo = require('./mongo');
var reportError = require('./error');
var utils = require('./utils');

var postFeed = function(req) {

    var keptf = ['location', 'when', 'order', 'content'];
    var supportInfo = _.merge(_.get(req.body, 'from'), {
        counter: 0,
        when: moment().format()
    });
    var timelinfo = _.reduce(req.body.content, function(memo, tle) {
        if(!_.isUndefined(_.get(tle, 'why'))) {
            debug("Ignoring entry %j", tle);
            return memo;
        }

        var rtVal = _.pick(tle, keptf);
        rtVal.content = _.map(rtVal.content, utils.tLineContentClean);
        rtVal.profileId = supportInfo.id;
        supportInfo.counter += 1;
        memo.push(rtVal);
        return memo;
    }, []);

    debugger;
    return Promise
        .all([ mongo.writeOne('supporters', supportInfo),
               mongo.writeMany('facebook1', timelinfo) ])
        .then(function(results) {
            if( results[0] && results[1]) {
                return {
                    'text': 'OK'
                };
            } else {
                reportError.reportError({
                    'when': moment(),
                    'function': 'postFeed',
                    'version': 1,
                    'info': results,
                })
                throw new Error();
            }
        })
};

var templateMap = {
    IT: jade.compileFile(__dirname + '/../sections/IT.jade'),
    US: jade.compileFile(__dirname + '/../sections/US.jade'),
    generic: jade.compileFile(__dirname + '/../sections/generic.jade', {
        pretty: true,
        debug: false
    })
};

var getIndex = function (req) {
    var sourceIP = _.get(req.headers, "x-forwarded-for");

    if(!_.isUndefined(sourceIP)) {
        geoinfo = geoip.lookup(sourceIP);
        debug("GeoIP of %s return %s", sourceIP, geoinfo.name);
    } else {
        geoinfo = {'code': null, 'name': null};
        debug("GeoIP absent!");
    };

    accessInfo = {
        when: moment().format(),
        ip: sourceIP,
        geo: geoinfo.code,
        refer: req.headers.referer
    };

    return Promise.resolve(
        /* stress test, because maybe is too much and is better 
         * keep in memory and flush once a while */
        mongo.writeOne('access', accessInfo)
    ).then(function() {

        if(!_.isUndefined(_.get(templateMap, geoinfo.code))) {
            debug("GeoIP of %s return %s", sourceIP, geoinfo.name);
            index = _.get(templateMap, geoinfo.code)({title: 'Home'});
        } else {
            debug("Returning generic template");
            index = templateMap['generic']({title: 'Home'});
        }

        return {
            'status': 200,
            'text': index,
        };
    });
};

module.exports = {
    postFeed: postFeed,
    getIndex: getIndex
};
