var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('utils');
var crypto = require('crypto');

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

/*
 21     processed = _.reduce(received, utils.processTimelines, {
    22         'timelines': [],
     23         'posts': [],
      24         'supportInfo': { 'numId': null, 'lastInfo': null },
      26     });

 = _.get(req.headers, "x-forwarded-for") || "127.0.0.1";
*/
/* used in .reduce of postFeed APIv3 */
var processTimelines = function(memo, tmln) {
    
    memo.posts = _.map(tmln.posts, function(post, counter, total) {
        
    });
};

var processHeaders = function(received, required) {
    var ret = {};
    _.each(required, function(destkey, headerName) {
        var r = _.get(received, headerName);
        if(_.isUndefined(r))
            return { error: "missing header " + headerName };

        _.set(ret, destkey, r);
    }, {});
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
};
