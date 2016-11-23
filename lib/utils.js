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
                + moment().format('hhmmss') + ".json";
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
