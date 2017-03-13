var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('lib:utils');
var crypto = require('crypto');
var foodWords = require('food-words');
var bs58 = require('bs58');
var nacl = require('tweetnacl');
var nconf = require('nconf');

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

var numId2Words = function(numList) {
    var size = _.size(foodWords);
    var num = _.reduce(numList, function(memo, n) { return memo+=n; }, 0);
    var first = _.nth(foodWords, (num % size));
    var second = _.nth(foodWords, ( (num * 2) % size));
    // debug("%j %d = %s-%s", numList, num, first, second);
    return first + "-" + second;
};

function DUMP(objz) {
    /* this is to avoid to write JSON.stringify in my life ever again */
    console.trace();
    console.log(" -- " + JSON.stringify(objz, undefined, 2));
};

function stringToArray (s) {
    // Credits: https://github.com/dchest/tweetnacl-util-js
    var d = unescape(encodeURIComponent(s));
    var b = new Uint8Array(d.length);

    for (var i = 0; i < d.length; i++) {
        b[i] = d.charCodeAt(i);
    }
    return b;
}

function encodeToBase58 (s) {
    return bs58.encode(s);
}

function decodeFromBase58 (s) {
    return new Uint8Array(bs58.decode(s));
}

function verifyRequestSignature(req) {
    // Assume that the tuple (userId, publicKey) exists in the DB.
    var userId = req.headers['x-fbtrex-userId'];
    var publicKey = req.headers['x-fbtrex-publickey'];
    var signature = req.headers['x-fbtrex-signature'];
    var message = req.body;

    // FIXME: apparently with Express 4 the body is a streamed buffer,
    // and I don't want to dig in that now. My "There I Fix It" solution
    // is to dump the json of the body in a string, and use that to verify
    // the signature.
    //
    //   WARNING!!!
    //   This works good when the client sending the data is in JavaScript
    //   as well, since key order is given by the insertion order.

    if (req.headers['content-type'] === 'application/json') {
        message = JSON.stringify(req.body)
    }

    return nacl.sign.detached.verify(
        stringToArray(message),
        decodeFromBase58(signature),
        decodeFromBase58(publicKey));
};

module.exports = {
    hash: hash,
    activeUserCount: activeUserCount,
    getGeoIP: getGeoIP,
    shmFileWrite: shmFileWrite,
    stripMongoId: stripMongoId,
    topPostsFixer: topPostsFixer,
    numId2Words: numId2Words,
    stringToArray: stringToArray,
    encodeToBase58: encodeToBase58,
    decodeFromBase58: decodeFromBase58,
    verifyRequestSignature: verifyRequestSignature,
    DUMP: DUMP
};
