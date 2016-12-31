var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:daily');
var nconf = require('nconf');
 
var mongo = require('./mongo');

function byDayStats(req) {
    /* it is clear this is not they way, but this is just legacy alpha */
    var what = _.get(req.params, 'what');
    var queryMap = {
        'impressions': [
            { 
                'name': 'impressions',
                'column': nconf.get('schema').impressions,
                'timevar': '$impressionTime',
                'filter': { impressionTime: { $gt: new Date('2016-12-08') }},
                'aggext': {}
            },
            {
                'name': 'htmls',
                'column': nconf.get('schema').htmls,
                'timevar': '$savingTime',
                'filter': { savingTime: { $gt: new Date('2016-12-08') }},
                'aggext': {}
            },
            {
                'name': 'timelines',
                'column': nconf.get('schema').timelines,
                'timevar': '$startTime',
                'filter': { startTime: { $gt: new Date('2016-12-08') }},
                'aggext': {}
            }
        ],
        'users': [
            {
                'name': 'activeusers',
                'column': nconf.get('schema').timelines,
                'timevar': '$startTime',
                'filter': { startTime: { $gt: new Date('2016-12-08') }},
                'aggext': { userId: "$userId" }
            },
            {
                'name': 'newusers',
                'column': nconf.get('schema').supporters,
                'timevar': '$keyTime',
                'filter': { keyTime: { $gt: new Date('2016-12-08') }},
                'aggext': {}
            },
            {
                'name': 'notcomingback',
                'column': nconf.get('schema').supporters,
                'timevar': '$lastActivity',
                'filter': { lastActivity: { $gt: new Date('2016-12-08') }},
                'aggext': {}
            },
            {
                'name': 'pageviews',
                'column': nconf.get('schema').accesses,
                'timevar': '$when',
                'filter': { when: { $gt: new Date('2016-12-08') }},
                'aggext': {}
            }
        ]
    };

    var statsMap  = queryMap[what]

    if(!statsMap) {
        debug("%s byDayStats invalid request %s", req.randomUnicode, what);
        throw new Error("Invalid request to /daily/(.*) ");
    }

    debug("%s byDayStats %s", req.randomUnicode, what);

    return dailyQuery(statsMap)
        .then(function(result) {
            return { "json": result };
        });
};

function dailyQuery(queryMap) {
    
    return Promise.map(queryMap, function(qM) {
        return mongo
            .countByDay(qM.column, qM.timevar, qM.filter, qM.aggext);
    })
    .map(function(unnamed, i) {
        return _.map(unnamed, function(dateObj) {
            dateObj.name = queryMap[i].name;
            return dateObj;
        });
    })
    .then(function(layered) {
        return _.flatten(layered);
    })
    .reduce(aggregateByDate, {})
    .then(function(collection) {
        return _.orderBy(collection, function(stOb) {
            return moment(stOb.date, "YYYY-M-D");
        });
    });
};


/* invoked by Promise.reduce above */
function aggregateByDate(memo, stOb) {

    /* remind, TODO, with aggext I've to extract an additional info from the ID to the 
     * object initialization below */
    var date = [ stOb["_id"].year, stOb["_id"].month, stOb["_id"].day].join('-');

    if(_.isUndefined(memo[date]))
        memo[date] = { date: date };

    _.set(memo[date], stOb.name, stOb.count);
    return memo;
};


/*
 * Internal function usersByDayByCountry was a duplicate of 
                     usersByDay (+ filter by geoip)
   now the           usersByDay
   is replaced by    countByDay, that waits for filter and
                                 aggegator extension

var countryStatsByDay = function(req) {
    var format = (req.params.format === 'json') ? 'json' : 'c3';
    var ccode = (req.params.countryCode);
    if(_.size(ccode) !== 2)
        throw new Error("Invalid size of country code");

    debug("%s countryStatsByDay of %s in format '%s'",
        req.randomUnicode, ccode, format);

    return mongo
        .usersByDayByCountry(nconf.get('schema').refreshes,
                             {"geoip": ccode })
        .then(function(lsol) {
            return _.map(lsol, function(d) {
                var when = _.get(d, "_id");
                return { "date": moment(when.year + "-" +
                                        when.month + "-" +
                                        when.day, "YYYY-MM-DD"),
                          "users": _.size(d.usersSeen)
                };
            });
        })
        .then(function(seq) {
            return _.sortBy(seq, 'date');
        })
        .then(function(results) {
            return { 'json': results };
        });
};

  *
  */

module.exports = {
    byDayStats: byDayStats
};
