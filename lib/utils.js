var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('utils');
var crypto = require('crypto');
var foodWords = require('food-words');

// why this node-geoip don't want initialize alone ? wtv
var Geo = require('node-geoip');
var G = new Geo.GeoIP(Geo.Database);

var getGeoIP = function(sourceIP) {
    var retVal = null;
    // handle 10.x.x.x 127.x.x.x 192.168.x.x 172.16.x.x as "reserved" ?
    if(!_.isUndefined(sourceIP)) {
        try {
            retVal = G.getCountry(sourceIP);
            debug("GeoIP of %s return %j", sourceIP, retVal);
        } catch (ex) {
            retVal = {'code': null, 'country': null, 'ip': sourceIP};
            // debug("GeoIP of %s %s", sourceIP, ex);
        }
    } else {
        retVal = {'code': null, 'country': null, 'ip': sourceIP};
        // debug("GeoIP absent for %s!", sourceIP);
    }
    return retVal;
}

var shmFileWrite = function(fprefix, stringblob) {
    var fpath = "/dev/shm/" + fprefix + "-"
                + moment().format('hhmmss') + ".escvi";
    return Promise.resolve(
        fs.writeFileAsync(fpath, stringblob)
          .then(function(result) {
              debug("written debug file %s", fpath);
              return true;
          })
          .catch(function(error) {
              debug("Error in writting %s: %s", fpath, error);
              return false;
          })
    );
};

var hash = function(obj, fields) {
    if(_.isUndefined(fields))
        fields = _.keys(obj);
    var plaincnt = fields.reduce(function(memo, fname) {
        return memo += fname + "∴" + _.get(obj, fname, '…miss!') + ",";
        return memo;
    }, "");
    // debug("Hashing of %s", plaincnt);
    sha1sum = crypto.createHash('sha1');
    sha1sum.update(plaincnt);
    return sha1sum.digest('hex');
};

/* this function is invoked by nodeActivity */
var statsReshape = function(statsList) {
    var unsorted = _.map(statsList, function(stOb) {
        return {
            'date': stOb["_id"].year + '-' + stOb["_id"].month + 
                    '-' + stOb["_id"].day,
            'count': stOb.count
        };
    });
    var sorted = _.orderBy(unsorted, function(stOb) {
        return moment(stOb.date, "YYYY-M-D");
    });
    return sorted;
};

var activeUserCount = function(usersByDay) {
    var uC = _.reduce(usersByDay, function(memo, stOb) {
        var date = stOb["_id"].year + '-' + stOb["_id"].month + 
                   '-' + stOb["_id"].day;
        if(_.isUndefined(memo[date]))
            memo[date] = [];
        memo[date].push(stOb["_id"].user);
        return memo;
    }, {});
    return _.map(uC, function(datec, datek) {
        return {
            'date': datek,
            'count': _.size(datec)
        }
    });
};

var getPostInfo = function(tle) {

    var p = _.first(tle.content);
    if(_.isNull(p)) {
        debug("First content is null %j", tle);
        return null;
    }
    var retVal = { 
        order: _.parseInt(tle.order),
        refreshUnique: _.parseInt(tle.refreshUnique),
        displayTime: new Date(tle.when),
        type: p.type
    };

    /* a couple of debug switch I'll remove or change to console.error
     * if more serious */
    switch(p.type) {
        case 'promoted':
            retVal.href = p.href
                .replace(/\?.*/, '')
                .replace(/\">.*/, '');
            if(!_.startsWith(retVal.href, 'https://www.facebook')) {
                debug("Problem here? (order %d) [%s]", 
                    retVal.order, retVal.ref);
                return null;
            }
            break;
        case 'feed':
            retVal.creationTime = new Date(moment(p.publicationTime)
                                           .toISOString());
            break;
        case 'friendlink':
            retVal.creationTime = new Date(moment(p.publicationTime)
                                           .toISOString());
            retVal.activityReason = p.additionalInfo;
            if( _.isUndefined(tle.content[1]) || 
                _.isNull(tle.content[1]) ||
                _.isUndefined(tle.content[1].type) ) {
                    debug("error here: %j", tle);
                    return null;
            } else if(tle.content[1].type !== "related") {
                debug("Can this really happen? %j", tle);
                return null;
            }
            break;
        default:
            debug("getPostInfo fail with post.type %s", p.type);
            return null;
    }

    retVal.postId = p.href.split('&')[0]
                          .replace(/=/, '/') /* photo */
                          .replace(/\./g, '/') /* set: test carefully */
                          .split('/')
                          .reduce(function(me, chunk) {
                              if(chunk === "photo.php?fbid")
                                  retVal.info = "photo";
                              return _.isNaN(me) ? _.parseInt(chunk) : me;
                          }, NaN);

    if(_.isNaN(retVal.postId) && retVal.type !== "promoted") {
        debug("Parsing error in getPostInfo: %j", tle);
        return null;
    }
    return retVal;
};

/* used in the postFeed APIv3 */
function checkError(retDict) {
    console.log(JSON.stringify(retDict, undefined, 2));
    var err = _.get(retDict, 'error');
    return !_.isUndefined(err);
};

function manageError(where, err, req) {
    debug("%s Error %s: %s", req.randomUnicode, where, error);
    return { 'error': where, 'what': err };
};

/* used in .reduce of postFeed APIv3 */
var processTimelines = function(memo, tmln) {

    memo.user.numId = _.parseInt(tmln.fromProfile);

    if(tmln.location !== 'https://www.facebook.com/')
        debug("Location %s", tmln.location);

    var newTmln = {
        unique: tmln.uuid,
        refreshTime: new Date(moment(tmln.dt).toISOString()),
        lastPosition: tmln.lastPosition,
        userId: memo.user.numId
    };
    memo.timelines.push(newTmln);

    memo.posts = _.concat(memo.posts, _.map(tmln.posts, function(p) {
        var basic = {
            order: p.position,
            timelineUnique: tmln.uuid,
            displayTime: new Date(moment(p.seenAt).toISOString())
            type: post.postType
            meta: []
        };
        return basic;
        /* TODO, add meta: 'via', 'id', 'link', 'source', 'creation' */
    });

    return memo;
};

var processHeaders = function(received, required) {
    var ret = {};
    var errs = _.map(required, function(destkey, headerName) {
        var r = _.get(received, headerName);
        if(_.isUndefined(r))
            return headerName;

        _.set(ret, destkey, r);
        return null;
    });
    errs = _.compact(errs);
    if(_.size(errs)) {
        return { 'error': errs };
    }
    return ret;
};

/* used in .reduce of postFeed APIv2 */
var processContribution = function(memo, tle, counter, total) {

    if(_.get(tle, 'what') === 'refresh') {
        memo.refreshes.push({
            refreshTime: tle.when,
            refreshUnique: _.parseInt(tle.unique)
        });
        return memo;
    }

    try {
        var purePost = getPostInfo(tle);
    } catch(error) {
        console.log("JavaScript error " + error);
        memo.anomaly = true;
        purePost = null;
    }

    if(_.isNull(purePost)) {
        memo.anomaly = true;
        return memo;
    }

    memo.timeline.push(purePost);
    return memo;
};

/* called as .map for every timeline entry */
var tLineContentClean = function(memo, ce) {

    if(_.isNull(ce) || _.isUndefined(ce))
        return memo;

    var cnte = _.omit(ce, ['utime']);
    if(!_.isUndefined(cnte['utime']))
        cnte = _.set(cnte, "etime", moment(ce.utime * 1000).format());

    if(_.isUndefined(cnte.additionalInfo) || 
      (_.size(cnte.addittionalInfo) < 3) )
        _.unset(cnte, 'additionalInfo');

    memo.push(cnte);
    return memo;
};

var stripMongoId = function(collection) {
    return _.map(collection, function(entry) {
        return _.omit(entry, ['_id']);
    });
};

var versionParse = function(rcvdStr) {
    if(_.isUndefined(rcvdStr))
        return '0.9.6';
    return rcvdStr.split('.').map(_.parseInt).join('.');
};

var topPostsFixer = function(mongocoll) {
    var MAX_ENTRIES = 20;
    var clean = _.reduce(mongocoll, function(memo, pe) {
        /* this in theory would be removed when mongoQuery is improved */
        if( _.eq(_.size(pe.users), 1))
            return memo;
        if( _.isNull(pe["_id"].postId))
            return memo;
        if( _.size(pe["_id"].postId + "") < 10)
            return memo;

        var times = _.sortBy(pe.times, moment);
        var msecduration = _.last(times) - _.first(times);
        var relative = moment() - _.first(times);

        /* is not kept 'first' because what matter is the creation time */
        memo.push({
                'postId': pe["_id"].postId,
                'lifespan': moment.duration(msecduration).humanize(),
                'when': moment.duration(relative).humanize(),
                'last': _.last(times),
                'users': pe.users,
                'count': _.size(pe.users)
            });
        return memo;
    }, []);

    return _.reverse(_.takeRight(_.sortBy(clean, 'count'), MAX_ENTRIES));
};

var formatNodeStats = function(mongoResults) {
  /* return .posts .timelines .users number with proper dict,
   * is formatted here because we are in transit version */
  return {
    'posts': mongoResults[0],     // timeline now, posts soon
    'users': mongoResults[2],     // supporters now and later 
    'timelines': mongoResults[1], // refreshes now, timelines soon
  };
};

var numId2Words = function(numList) {
    var size = _.size(foodWords);
    var num = _.reduce(numList, function(memo, n) { return memo+=n; }, 0);
    var first = _.nth(foodWords, (num % size));
    var second = _.nth(foodWords, ( (num * 2) % size));
    // debug("%j %d = %s-%s", numList, num, first, second);
    return first + "-" + second;
};

module.exports = {
    tLineContentClean: tLineContentClean,
    processContribution: processContribution,
    processHeaders: processHeaders,
    getPostInfo: getPostInfo,
    hash: hash,
    statsReshape: statsReshape,
    activeUserCount: activeUserCount,
    getGeoIP: getGeoIP,
    shmFileWrite: shmFileWrite,
    stripMongoId: stripMongoId,
    versionParse: versionParse,
    topPostsFixer: topPostsFixer,
    formatNodeStats: formatNodeStats,
    numId2Words: numId2Words
};
