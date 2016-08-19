var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('utils');
var crypto = require('crypto');
var geoip = require('geoip-native');

var getGeoIP = function(sourceIP) {
    var retVal = null;
    if(!_.isUndefined(sourceIP)) {
        retVal = geoip.lookup(sourceIP);
        debug("GeoIP of %s return %s", sourceIP, retVal.name);
    } else {
        retVal = {'code': null, 'name': null};
        debug("GeoIP absent for %s!", sourceIP);
    };
    return retVal;
}

var JSONsave = function(basepath, source, jsonblob) {
    var fpath = basepath + "/" 
                + source + "-" 
                + moment().format('hhmmss') + ".json";
    return Promise.resolve(
        fs.writeFileAsync(fpath, JSON.stringify(jsonblob, undefined, 2))
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
    debug("Hashing of %s", plaincnt);
    sha1sum = crypto.createHash('sha1');
    sha1sum.update(plaincnt);
    return sha1sum.digest('hex');
};

/*
  utils Parsing error in getPostInfo: {"when":"2016-08-15T12:32:01+02:00","refreshUnique":4023094629,"order":33,"content":[{"href":"https://www.facebook.com/media/set/?set=a.10153970922198717.1073741850.650848716&amp;type=3\">Sardegna 2016</a>.</span></span></h5><div class=\"_5pcp\"><span><span class=\"fsm fwn fcg\"><abbr title=\"Domenica 14 agosto 2016 alle ore 21:18","additionalInfo":"https://www.facebook.com/carlo.frinolli","publicationTime":"2016-08-14T21:18:05+02:00","type":"feed"}]} +4ms

 */
var getPostInfo = function(tle) {

    var p = _.first(tle.content);
    var retVal = { 
        order: _.parseInt(tle.order),
        refreshUnique: _.parseInt(tle.refreshUnique),
        type: p.type
    };

    /* a couple of debug switch I'll remove or change to console.error
     * if more serious */
    switch(p.type) {
        case 'promoted':
            retVal.href = p.href.replace(/\?.*/, '');
            if(!_.startsWith(retVal.href, 'https://www.facebook'))
                debug("Problem here? (order %d) [%s]", 
                    retVal.order, retVal.ref);
            break;
        case 'feed':
            retVal.postTime = p.publicationTime;
            break;
        case 'friendlink':
            retVal.postTime = p.publicationTime;
            retVal.activityReason = p.additionalInfo;
	    if(_.isUndefined(tle.content[1]) || 
		_.isNull(tle.content[1]) ||
		_.isUndefined(tle.content[1].type) ) {
                debug("error here: %j", tle);
	    } else if(tle.content[1].type !== "related")
                debug("Can this really happen? %j", tle);
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
                              // console.log(chunk);
                              if(chunk === "photo.php?fbid")
                                  retVal.info = "photo";
                              return _.isNaN(me) ? _.parseInt(chunk) : me;
                          }, NaN);

    if(_.isNaN(retVal.postId) && retVal.type !== "promoted") {
        debug("Parsing error in getPostInfo: %j", tle);
    }
    return retVal;
};

/* used in .reduce of postFeed APIv2 */
var processContribution = function(memo, tle) { 

    if(_.get(tle, 'what') === 'refresh') {
        memo.current = _.parseInt(tle.unique);
        memo.refreshes.push({
            refreshTime: tle.when,
            refreshUnique: memo.current
        });
        return memo;
    }

    var purePost = getPostInfo(tle);

    if(_.isNull(purePost)) {
        console.error("Error in parsing a received feed/post");
        console.error(JSON.stringify(tle, undefined, 2));
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

module.exports = {
    tLineContentClean: tLineContentClean,
    processContribution: processContribution,
    getPostInfo: getPostInfo,
    hash: hash,
    getGeoIP: getGeoIP,
    JSONsave: JSONsave
};
