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
var TIMELINE_ENTRIES = 900;

var filterByTime = function(list, referenceTime) {
    var compareT = moment(referenceTime);
    return _.reject(list, function(postO) {
        return moment(postO.creationTime).isAfter(compareT);
    });
};

var timelineToPresence = function(tlent) {

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

        var check = moment(memo.lastTime).subtract('5', 'm');
        if( (thisDisplay).isBefore(check) ) {
            /* more than 5 minutes passed = a new "period of usage" */
            memo = newSession(memo, entry);
        } else {
            /* less than 5 minutes, remain the same session */
            memo = updateExistingSession(memo, entry);
        }
        memo = updateMemo(memo, entry);
        return memo;

    }, { ordered: [], lastTime: null });

    return reduced.ordered;
};

var estimateUserPresence = function(userObj) {
    debug("estimateUserPresence for %j", userObj);
    /* oldest at the beginning, by displayTime */
    return postInAnalysis(userObj)
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
    var ordered = _.sortBy(tlent, sortByCreationTime);
    debug("doing uniq over %d posts and stripping the 'promoted'", 
        _.size(ordered));
    var uniqued = _.uniqBy(ordered, 'postId');
    /* chronological order is not preserved */
    return _.sortBy(uniqued, sortByCreationTime);
};

var absolutePostList = function(userObj) {
    debug("absolutePostList for %j", userObj);
    return postInAnalysis(userObj)
      .then(function(entries) {
          /* has to return a list of post chronologically
           * ordered per publication time, so can be 
           * compared with a post to deduct the chronological
           * order in the past, so with the function splitByTime */
          return timelineToAbsolute(entries);
      });
};

var postInAnalysis = function(userObj) {
    return mongo
      .readLimit(nconf.get('schema').timeline, userObj,
             { displayTime: -1 }, TIMELINE_ENTRIES, 0)
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

var feedDistortion= function(userObj) {
    debug("feedDistortion for %j", userObj);
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
