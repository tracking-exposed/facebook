var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('c3');
var crypto = require('crypto');

var gridReferences = function() {
    var retVal = [];
    var gridrefs = [
        {
          'label': 'one hour ago',
          'fmt': 'HH:mm',
          'when': moment().subtract(1, 'h')
        },
        {
          'label': 'twelve hours ago',
          'fmt': 'HH:mm',
          'when': moment().subtract(12, 'h')
        },
        {
          'label': 'yesterday',
          'fmt': 'dddd',
          'when': moment().subtract(1, 'd')
        },
        {
          'label': 'three days ago',
          'fmt': 'dddd',
          'when': moment().subtract(3, 'd')
        },
        {
          'label': 'five days ago',
          'fmt': 'dddd',
          'when': moment().subtract(5, 'd')
        },
        {
          'label': 'one week ago',
          'fmt': 'DD dddd',
          'when': moment().subtract(7, 'd')
        },
        {
          'label': 'two weeks ago',
          'fmt': 'DD dddd',
          'when': moment().subtract(14, 'd')
        }
    ];
    return _.map(gridrefs, function(period) {
        var gridline = {
            value: moment().diff(period.when, 'hours'),
            text: period.label + ", " + period.when.format(period.fmt),
            position: 'middle'
        };
        return gridline;
    });
};

/* used by getPersonal */
var presenceToC3 = function(jSrc) {

    var lines = gridReferences();
    var data = _.map(jSrc, function(activtr) {
        var S = moment(activtr.start);
        var E = moment(activtr.end);
        var info = moment.duration(E - S).humanize();
        var newact = {
            value: moment().diff(S, 'hours'),
            refreshes: activtr.refreshes,
            'posts seen': activtr.posts,
            start: activtr.start,
            duration: info
        };
        return newact;
    });

    return {
        'lines': lines,
        'data': data
    }
};

/* this return an aggregated result: per every hour in the past,
 * plus the gridrefs, show how many posts get posted (that user
 * saw). it is not a very meaningful viz, but is the columnification
 * of the absolute post API 
 *
 * this is also an experiment of http://c3js.org/reference.html#data-json
 *
 * */
var absoluteToC3 = function(jSrc) {

    var lines = gridReferences();

    var postsByHour = _.reduce(jSrc, function(memo, entry) {
        var pT = moment(entry.creationTime);
        var hoursAgo = moment().diff(pT, 'hours');
        if(_.isUndefined(memo[hoursAgo])) {
            memo[hoursAgo] = [];
        }
        memo[hoursAgo].push(entry);
        return memo;
    }, {});

    var necroPosts = 0;
    var data = _.reduce(postsByHour, function(memo, hblock, hnum) {
        var newvalue = {
            hours: hnum,
            'published posts': _.size(hblock),
            info: hblock
        };
        /* posts like "5 years ago you were doing blah" are cut off here */
        if(hnum > 336) {
            necroPosts +=1;
            return memo;
        }
        memo.push(newvalue);
        return memo;
    });

    if(necroPosts)
        debug("posts older than 3 weeks, not reported: %d", necroPosts);

    return {
        'lines': lines,
        'data': data
    }
};

/* used by getImpact */
var statsToC3 = function(jSrc, directive) {
    var columns = {
        'x': [ 'x' ],
        'supporters': [ 'supporters' ],
        'timeline': [ 'timeline' ],
        'refreshes': [ 'refreshes' ],
        'users': [ 'users' ]
    }

    var Xs = _.map(_.last(jSrc.json).stats, function(value) {
        return value.date;
    });
    columns.x = _.concat(columns.x, Xs);

    _.each(Xs, function(expectedDate) {
        var S = _.filter(jSrc.json[0].stats, { date: expectedDate });
        if(!_.size(S))
            columns.supporters = _.concat(columns.supporters, 0);
        else
            columns.supporters = _.concat(columns.supporters, S[0].count);

        var T = _.filter(jSrc.json[1].stats, { date: expectedDate });
        if(!_.size(T))
            columns.timeline = _.concat(columns.timeline, 0);
        else
            columns.timeline = _.concat(columns.timeline, T[0].count);

        var R = _.filter(jSrc.json[2].stats, { date: expectedDate });
        if(!_.size(R))
            columns.refreshes = _.concat(columns.refreshes, 0);
        else
            columns.refreshes = _.concat(columns.refreshes, R[0].count);

        var U = _.filter(jSrc.json[3].stats, { date: expectedDate });
        if(!_.size(U))
            columns.users = _.concat(columns.users, 0);
        else
            columns.users = _.concat(columns.users, U[0].count);
    });

    return {
        json: _.map(columns, function(C) { return _.values(C); })
    };
}

module.exports = {
    statsToC3: statsToC3,
    presenceToC3: presenceToC3,
    absoluteToC3: absoluteToC3
};
