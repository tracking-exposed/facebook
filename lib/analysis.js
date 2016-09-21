var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('analysis');
var crypto = require('crypto');
var nconf = require('nconf');

var mongo = require('./mongo');

/* some static var used as safe limit of algorithms below */
var MAX_TIME_IN_PAST = '1 month';
var TIMELINE_ENTRIES = 900;

var splitByTime = function(list, referenceTime) {
    debugger;
};

var timelineToPresence = function(tlent) {

    var newSession =  function(memo, entry) {
        var rId = entry.refreshId;
        var newSession = {};
        _.set(newSession, 'start', moment(entry.displayTime).format());
        _.set(newSession, 'posts', 1);
        newSession['refreshes'] = {};
        newSession['refreshes'][rId] = 1;
        _.set(newSession, 'end', moment(entry.displayTime).format());
        memo.ordered.push(newSession);
    };

    var updateExistingSession = function(memo, entry) {
        memo.ordered[_.size(memo.ordered) -1].posts += 1;
        memo.ordered[_.size(memo.ordered) -1].end = 
              moment(entry.displayTime).format();

        var refO = memo.ordered[_.size(memo.ordered) -1].refreshes;
        var refPn = _.get(refO, entry.refreshId, 0);
        memo.ordered[_.size(memo.ordered) -1]
            .refreshes[entry.refreshId] = refPn + 1;
    };

    var updateMemo = function(memo, entry) {
        memo.lastTime = moment(entry.displayTime).format();
        memo.ordered[_.size(memo.ordered) -1].end = 
              moment(entry.displayTime).format();
    };

    var reduced = _.reduce(tlent, function(memo, entry) {

        var thisDisplay = moment(entry.displayTime);
        if(_.isNull(memo.lastTime)) {
            newSession(memo, entry);
            updateMemo(memo, entry);
            return memo;
        }

        var check = moment(memo.lastTime).add('5', 'm');
        if( (check).isBefore(thisDisplay) ) {
            /* more than 5 minutes passed = a new "period of usage" */
            newSession(memo, entry);
        } else {
            /* less than 5 minutes, remain the same session */
            updateExistingSession(memo, entry);
        }
        updateMemo(memo, entry);
        return memo;

    }, { ordered: [], lastTime: null });

    console.log(JSON.stringify(reduced.ordered, undefined, 2));
    return reduced.ordered;
};

var estimateUserPresence = function(userObj) {
    debug("Estimate presence of %j", userObj);
    /* oldest at the beginning, by displayTime */
    return mongo
        .readLimit(nconf.get('schema').timeline, userObj,
                 { displayTime: 1 }, TIMELINE_ENTRIES, 0)
        .then(function(entries) {
          /* has to return a non time-constant sequence of 
           * dates with number of posts seen in the timelapses of
           * 10 minutes */
          return timelineToPresence(entries);
        });
};


var timelineToAbsolute = function(tlent) {
    var ordered = _.sortBy(tlent, function(entry) {
        return moment(entry.creationTime);
    });
    debug("doing uniq over %d posts and stripping the 'promoted'", 
        _.size(ordered));
    return _.reject(_.uniqBy(ordered, 'postId'), {postId : null });
};

var absolutePostList = function(userObj) {
   return mongo
      .readLimit(nconf.get('schema').timeline, userObj,
                 { displayTime: -1 }, TIMELINE_ENTRIES, 0)
      .then(function(entries) {
          /* has to return a list of post chronologically
           * ordered per publication time, so can be 
           * compared with a post to deduct the chronological
           * order in the past, so with the function splitByTime */
          return timelineToAbsolute(entries);
      });
};


var flactuation = function(userObj) {
   return mongo
      .readLimit(nconf.get('schema').timeline, userObj,
                 { displayTime: -1 }, TIMELINE_ENTRIES, 0)
      .then(function(entries) {
          /* having absolutePostList and estimateUserPresence,
           * pass through all the posts and mark +/- position to
           * express an "Advantage" v "Disadvantage" values */
          return timelineToAbsolute(entries);
      });
      // TODO other stuff
};

module.exports = {
    estimateUserPresence: estimateUserPresence,
    absolutePostList: absolutePostList,
    flactuation: flactuation
};
