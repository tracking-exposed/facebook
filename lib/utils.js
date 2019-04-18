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

function hash(obj, fields) {
    // please remind self: NEVER CHANGE THIS
    if(_.isUndefined(fields))
        fields = _.keys(obj);
    const plaincnt = fields.reduce(function(memo, fname) {
        return memo += fname + "∴" + _.get(obj, fname, '…miss!') + ",";
    }, "");
    // debug("Hashing of Object %s", plaincnt);
    sha1sum = crypto.createHash('sha1');
    sha1sum.update(plaincnt);
    return sha1sum.digest('hex');
};

function smallhash(obj) {
    return hash(obj).substr(0, 6);
};

function hashList(list) {
    const plaincnt = JSON.stringify(list);
    // debug("HashList of %s", plaincnt);
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

function number2Food(number) {
    var size = _.size(foodWords);
    var first = _.nth(foodWords, (number % size));
    var second = _.nth(foodWords, ( (number * 2) % size));
    return [ first, second ];
};

function string2Food(text) {
    var number = _.reduce(_.split(text), function(memo, c) {
        if(c.charCodeAt() < 60)
           return memo * (c.charCodeAt() + 1);

        return c.charCodeAt() + memo;
    }, 1);
    return number2Food(number);
};

function pseudonymizeTmln(timelineId) {
    return pseudonymize(`timeline${timelineId}`, 3);
}

function pseudonymizeUser(userId) {
    return pseudonymize(`user${userId}`, 3);
}

function pseudonymize(piistr, numberOf) {
    const inputs = _.times(numberOf, function(i) {
        return _.reduce(i + piistr, function(memo, acharacter) {
            var x = memo * acharacter.charCodeAt(0);
            memo += ( x / 23 );
            return memo;
        }, 1);
    });
    const size = _.size(foodWords);
    const ret = _.map(inputs, function(pseudornumber) {
        return _.nth(foodWords, (_.round(pseudornumber) % size));
    });
    return _.join(ret, '-');
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

function feedPath(feedId) {
    const XMLrootpath = path.join(__dirname, '..', rss);
    debug("path");
    return "path";
};

module.exports = {
    hash: hash,
    smallhash: smallhash,
    hashList: hashList,
    activeUserCount: activeUserCount,
    getGeoIP: getGeoIP,
    shmFileWrite: shmFileWrite,
    stripMongoId: stripMongoId,
    topPostsFixer: topPostsFixer,
    number2Food: number2Food,
    string2Food: string2Food,
    pseudonymize: pseudonymize,
    stringToArray: stringToArray,
    encodeToBase58: encodeToBase58,
    decodeFromBase58: decodeFromBase58,
    verifyRequestSignature: verifyRequestSignature,
    DUMP: DUMP,
    pseudonymizeTmln: pseudonymizeTmln,
    pseudonymizeUser: pseudonymizeUser,
    feedPath: feedPath,
};
