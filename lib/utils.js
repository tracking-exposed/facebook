var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('utils');
var crypto = require('crypto');


/* spare utility awaiting to be put in a dedicated library */
var JSONsave = function(basepath, source, jsonblob) {

    var fpath = basepath + "/" 
                + source + "-" 
                + moment().format('hhmmss') + ".json";

    return Promise.resolve(
        fs.writeFileAsync(fpath, JSON.stringify(jsonblob, undefined, 2))
          .then(function(result) {
              debug("written debug file %s", fpath);
          })
    );
};

var hash = function(obj, fields) {
    var plaincnt = fields.reduce(function(memo, fname) {
        return memo += fname + "∴" + _.get(obj, fname, '…miss!') + ",";
        return memo;
    }, "");
    debug("Hashing of %s", plaincnt);
    sha1sum = crypto.createHash('sha1');
    sha1sum.update(plaincnt);
    return sha1sum.digest('hex');
};

var getPostInfo = function(tle) {
    var p = _.first(tle.content);
    var simpleKind = p.type === "promoted" ? "promoted" : "feed";

    if(_.size(tle.content) == 2) {
        if(tle.content[0].href !== tle.content[1].href) {
            debug("Problem!! :(");
            console.log(JSON.stringify(tle, undefined, 2));
        }
    }
    var photoPostUnif = p.href.split('&')[0].replace('=', '/');

    var postId = photoPostUnif.split('/').reduce(function(memo, chunk) {
        if(!_.isNaN(memo))
            return memo;
        return _.parseInt(chunk);
    }, NaN);

    return {
        postId: postId,
        kind: simpleKind,
        publishedTime: p.utime,
    };
};

/* rivedi sta funzione degnamente */
var analyzePosts = function(memo, tle) { 
    /* used only with location as '/' */

    var why = _.get(tle, 'why') || null;
    var purePost = null;

    if(_.isNull(why)) {
        purePost = getPostInfo(tle);
        memo.existingPosts.push(purePost);
    }

    if(_.isNull(why) && tle.location === '/') {
        if(_.isUndefined(memo.last.refresh_time)) {
            memo.last.refresh_time = tle.when;
            memo.last.refresh_hash = hash(memo.last, [
                  'refresh_time', 
                  'profileId' 
            ]);
        }

        memo.last.length += 1;
        memo.last.posts.push(_.extend(purePost, { 
            order: tle.order
        }));
        return memo;
    }

    if(why === "location_switch" && tle.new === '/') {
        if(_.isUndefined(memo.last.refresh_time)) {
            debug("confirm that I'm here");
            memo.last.refresh_time = tle.when;
        }
    }

    if(why === "location_switch" && tle.new !== '/') {

        if(_.size(memo.last.posts))
            memo.homePageColl.push(memo.last);
        else
            debug("Unexpected anomaly here? run debugger");

        memo.last = {
            length: 0,
            profileId: memo.last.profileId,
            posts: []
        };
    }
    return memo;
};


var keepRawInfo = function(memo, tle) {
    /* why is present only in location switch and debug info */
    var keptf = ['location', 'when', 'order', 'content'];
    var why = _.get(tle, 'why') || null;

    if(!_.isNull(why))
        return memo;

    var cleanTLe = _.pick(tle, keptf);
    cleanTLe.content.reduce(tLineContentClean, []);
    memo.push(cleanTLe);
    
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
    keepRawInfo: keepRawInfo,
    analyzePosts: analyzePosts,
    JSONsave: JSONsave
};
