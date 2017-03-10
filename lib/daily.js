var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:daily');
var nconf = require('nconf');
 
var mongo = require('./mongo');

function getStats(req) {
    var what = _.get(req.params, 'what');
    debug("getStats on %s", what);

    /* Client side the data is aggregated in bigger unit than hour, or chunked.
     * three months return ~ 300k, therefore some chunking might be done
     * server side, but talking about semesters... */
    return mongo
        .read(nconf.get('schema').hourlyIO, { type: what })
        .then(function(ret) {
            if(what === 'basic') {
                return { json: _.map(ret, function(o) {
                    o = _.omit(o, ['_id', 'id', 'visitcc', 'timelinecc', 'type']);
                    o.start = moment(o.start).format("YYYY-MM-DD HH") + ":00:00";
                    return o;
                }) };
            } else if(what === 'metadata') {
                return { json: _.map(ret, function(o) {
                    o = _.omit(o, ['_id', 'id', 'type']);
                    o.start = moment(o.start).format("YYYY-MM-DD HH") + ":00:00";
                    return o;
                }) };
            }
            /* geo location graph not managed yet */
            return { json: ret };
        });
};

module.exports = {
    getStats: getStats
};
