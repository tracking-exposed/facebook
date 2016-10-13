var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('analysis');
var crypto = require('crypto');
var nconf = require('nconf');

var mongo = require('./mongo');
var utils = require('./utils');

/* some static var used as safe limit of algorithms below, not really
 * user right now */
var MAX_TIME_IN_PAST = '1 month';
var TIMELINE_ENTRIES = 2000;

/*
 * This analysis library provide some high level output:
 * estimateUserPresence: do an averaged of latest users activities,
 *                       based on the last TIMELINE_ENTRIES posts
 *                       or by the variable passed
 * absolutePostList: 
 * feedDistortion: TODO change it based on a single refresh
 */

var filterByTime = function(list, referenceTime) {
    var compareT = moment(referenceTime);
    return _.reject(list, function(postO) {
        return moment(postO.creationTime).isAfter(compareT);
    });
};

var timelineToPresence = function(tlent) {
    /* 5 minutes ? 1 hour ? here is set how much you consider two
     * refreshes as part of the same "navigation session" */
    var unit = '5';
    var measure = 'm';

    var newSession =  function(memo, entry) {
        var rId = entry.refreshId;
        var newSession = {};
        _.set(newSession, 'end', moment(entry.displayTime).format());
        _.set(newSession, 'posts', 1);
        newSession['refreshes'] = {};
        newSession['refreshes'][rId] = 1;
        _.set(newSession, 'start', moment(entry.displayTime).format());
        memo.ordered.push(newSession);
        return memo;
    };

    var updateExistingSession = function(memo, entry) {
        memo.ordered[_.size(memo.ordered) -1].posts += 1;
        memo.ordered[_.size(memo.ordered) -1].start = 
              moment(entry.displayTime).format();

        var refO = memo.ordered[_.size(memo.ordered) -1].refreshes;
        var refPn = _.get(refO, entry.refreshId, 0);
        memo.ordered[_.size(memo.ordered) -1]
            .refreshes[entry.refreshId] = refPn + 1;
        return memo;
    };

    var updateMemo = function(memo, entry) {
        memo.lastTime = moment(entry.displayTime).format();
        memo.ordered[_.size(memo.ordered) -1].start = 
              moment(entry.displayTime).format();
        return memo;
    };

    var reduced = _.reduce(tlent, function(memo, entry) {

        var thisDisplay = moment(entry.displayTime);
        if(_.isNull(memo.lastTime)) {
            memo = newSession(memo, entry);
            memo = updateMemo(memo, entry);
            return memo;
        }

        var check = moment(memo.lastTime).subtract(unit, measure);
        if( (thisDisplay).isBefore(check) ) {
            /* more than X minutes passed = a new "period of usage" */
            memo = newSession(memo, entry);
        } else {
            /* less than X minutes, we consider belong to the same session */
            memo = updateExistingSession(memo, entry);
        }
        memo = updateMemo(memo, entry);
        return memo;

    }, { ordered: [], lastTime: null });

    return reduced.ordered;
};

var estimateUserPresence = function(userObj, consideredPostsN) {
    debug("estimateUserPresence for %j %d", userObj, consideredPostsN);
    /* oldest at the beginning, by displayTime */
    return postInAnalysis(userObj, consideredPostsN)
      .then(function(entries) {
          /* has to return a non time-constant sequence of 
           * dates with number of posts seen in the timelapses of
           * 10 minutes */
          return timelineToPresence(entries);
      });
};

var sortByCreationTime = function(entry) {
    return moment(entry.creationTime);
};

var timelineToAbsolute = function(tlent) {
    var uniqued = _.uniqBy(tlent, 'postId');
    var cleaned = _.reject(uniqued, {'postId': null});
    var errorfree = _.reject(cleaned, function(entry) {
        /* because some current parsing error lead post with 'epoch' time */
        return moment(entry.creationTime).isBefore(moment('1980', 'YYYY'));
    });
    var simple = _.map(errorfree, function(pe) {
        /* when more info would be available, like the author,
         * should be expanded */
        return _.pick(pe, ['postId', 'creationTime' ]);
    });
    debug("timelineToAbsolute, from %d posts reduced to %d", 
        _.size(tlent), _.size(simple));
    return _.sortBy(simple, sortByCreationTime);
};

var absolutePostList = function(userObj, consideredPostsN) {
    debug("absolutePostList for %j posts %d", userObj, consideredPostsN);
    return postInAnalysis(userObj, consideredPostsN)
      .then(function(entries) {
          /* has to return a list of post chronologically
           * ordered per publication time, so can be 
           * compared with a post to deduct the chronological
           * order in the past, so with the function splitByTime */
          return timelineToAbsolute(entries);
      });
};

var postInAnalysis = function(userObj, consideredPostsN) {
    if(_.isUndefined(consideredPostsN)) {
        debug("postInAnalysis with default posts number (%d)",
            TIMELINE_ENTRIES);
        consideredPostsN = TIMELINE_ENTRIES;
    }
    return mongo
      .readLimit(nconf.get('schema').timeline, userObj,
             { displayTime: -1 }, consideredPostsN, 0)
      .then(function(mongofmt) {
          var result = _.reject(mongofmt, {postId : null });
          return utils.stripMongoId(result)
      });
};

var postOrderInfo = function(absolute, post) {
    /* 1
     *  take post display time, removed what
     *  was not available at the time */
    var availp = filterByTime(absolute, post.displayTime);
    /* 2
     *  look via postId the same post */
    var found = _.find(availp, {postId: post.postId});
    /* 3
     *  check at which distance was supposed to be if chronological */
    var trueplace = _.indexOf(availp, found);
    /* debug("post order %d in avail %d posts (from %d), has to be %d?",
        post.order, _.size(availp), _.size(absolute), trueplace); */
    return _.extend(found, {
        'trueplace': trueplace,
        'availposts': _.size(availp),
        'originalavail': _.size(absolute)
    });
};

var feedDistortion= function(userObj, consideredPostsN) {
    debug("feedDistortion for %j posts %d", userObj, consideredPostsN);
    retV = {};
    return Promise
        .all([
            absolutePostList(userObj),
            estimateUserPresence(userObj),
            postInAnalysis(userObj)
        ])
        .then(function(results) {
            retV['absolute'] = results[0];
            retV['presence'] = results[1];
            var trueplace = _.map(results[2], function(p) {
                return postOrderInfo(results[0], p);
            });
            retV['trueplace'] = _.reverse(trueplace);
            return retV;
        });
};


module.exports = {
    estimateUserPresence: estimateUserPresence,
    absolutePostList: absolutePostList,
    feedDistortion: feedDistortion
};
