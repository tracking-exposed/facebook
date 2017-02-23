var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:api-1');
var os = require('os');
var disk = Promise.promisifyAll(require('diskusage'));
var nconf = require('nconf');
 
var mongo = require('./mongo');
var utils = require('./utils');
var analysis = require('./analysis');

var nodeInfo = function(req) {
    debug("%s nodeInfo", req.randomUnicode);

    return Promise
        .map(_.values(nconf.get('schema')), function(tableName) {
            return mongo.countByObject(tableName);
        })
        .then(function(dbcounts) {
            return _.reduce(nconf.get('schema'), function(memo, cN, name) {
                var o = _.first(_.nth(dbcounts, _.size(memo)));
                memo[name] = _.isUndefined(o) ? "0" : o.count;
                return memo;
            }, {});
        })
        .then(function(namedNumbers) {
            return disk
                .checkAsync('/')
                .then(function(freebytes) {
                    return {
                        json: {
                            columns: namedNumbers,
                            disk: freebytes,
                            loadavg: os.loadavg(),
                            totalmem: os.totalmem(),
                            freemem: os.freemem()
                        }
                    };
                });
        });
};

/* used by country pie, in /impact */
var countriesStats = function(req) {
    debug("%s countriesStats, forced as c3/column output", req.randomUnicode);

    return mongo
        .countByObject(nconf.get('schema').timelines, {"country": "$geoip"})
        .then(function(countbc) {
            return _.map(countbc, function(centry) {
                return _.extend(centry["_id"], {
                    "number": centry.count
                });
            });
        })
        .then(function(completecc) {
            /* remove the 'null' entries and the < 10 occurrencies */
            var cutoff = _.reject(completecc, function(cen) {
                if(_.isNull(cen.country)) {
                    debug(" !country null found (%d entries)", cen.number);
                    return true;
                }
                return _.lt(cen.number, 10);
            });
            debug("%s removed %d countries from %d (now %d)",
                req.randomUnicode, (_.size(completecc) - _.size(cutoff)),
                _.size(completecc), _.size(cutoff));

            return _.map(cutoff, function(centry) {
                return [ centry.country, centry.number ];
            });
        })
        .then(function(results) {
            return { 'json': results };
        });

};

/* experiments to be killed out or re structued in the ß data */
var userAnalysis = function(req) {
    var format = (req.params.format === 'json') ? 'json' : 'c3';
    var kind = String(req.params.kind);
    var consideredP = _.parseInt(req.params.cpn);
    var filter = { "userId": _.parseInt(req.params.userId) };

    if(_.isNaN(filter.userId) || _.isNaN(consideredP))
        throw new Error("Invalid userId or consideredP");

    debug("%s userAnalysis [%s] format %s for %j posts-space %d",
          req.randomUnicode, kind, format, filter, consideredP);

    switch(kind) {
        case 'presence':
            var apromise = analysis.estimateUserPresence(filter, consideredP)
            break;
        case 'absolute':
            var apromise = analysis.absolutePostList(filter, consideredP);
            break;
        default:
            throw new Error("developer check this wrong kind: ["+kind+"]");
    };

    return Promise
        .resolve(apromise)
        .then(function(ret) {
            if(format === 'c3') {
                var convertor = {
                    'presence': c3conv.presenceToC3,
                    'absolute': c3conv.absoluteToC3
                };
                return { 'json': convertor[kind](ret) };
            }
            else {
                return { 'json': ret };
            }
        });
};

/* used in realitycheck, to be restored with more data and better viz */
var postLife = function(req) {
    /* not used, probably meaningful only if realitycheck is extended */
    var postId = _.parseInt(req.params.postId);
    var userId = _.parseInt(req.params.userId);

    if( _.isNaN(postId) || _.isNaN(userId) )
        throw new Error("NaN postId || userId");
    debug("%s PostLife user %d post %d",
        req.randomUnicode, userId, postId);

    return mongo
        .read( nconf.get('schema').timeline,
               { postId: postId, userId: userId }, {"$displayTime": 1})
        .then(function(result) {
            return {
                'json': utils.stripMongoId(result)
            };
        });
};

/* same */
var postReality = function(req) {
    /* To get the real picture of a post visibility, we need to get
     * all the access an user had, because the lack of visualisation is
     * itself an information. This is the reason why this API has
     * a chain of query */
    var postId = _.parseInt(req.params.postId);
    if(_.isNaN(postId))
        throw new Error("not a postId received?");
    debug("%s postReality %d", req.randomUnicode, postId);

    return Promise.all([
        mongo
          .getPostRelations(nconf.get('schema').timeline, {postId: postId}),
        mongo
          .read(nconf.get('schema').timeline, {postId: postId})
    ])
    .then(function(results) {
        var postPresence =  utils.stripMongoId(_.last(results));
        var relations = _.first(utils.topPostsFixer(_.first(results)));
        /* time range is 'creationTime' and 'last display + 2 minutes */
        var begin = moment(_.first(postPresence).creationTime);

        if(_.isUndefined(relations.last)) {
            debug("postReality error: %s", JSON.stringify(results));
            throw new Error("postReality");
        }
        var end = moment(relations.last).add(2, 'minutes');
        return _.map(relations.users, function(userId) {
            return {
                userId: userId,
                postPres: postPresence,
                begin: begin,
                end: end
            };
        });
    })
    .map(function(info) {
        return mongo.read(nconf.get('schema').refreshes, {
            "userId": info.userId, "refreshTime": {
                "$gt": new Date(info.begin),
                "$lt": new Date(info.end)
            }
        }, {})
        .reduce(function(memo, refByU) {
            var x = _.find(info.postPres, { refreshId: refByU.refreshId });
            var ref = moment(refByU.refreshTime).toISOString();
            if(_.isUndefined(x)) {
                memo.stats.push({
                    refreshTime: ref,
                    presence: false,
                    userPseudo: memo.pseudonym
                });
            } else {
                memo.stats.push({
                    refreshTime: ref,
                    presence: true,
                    order: x.order,
                    type: x.type,
                    userPseudo: memo.pseudonym
                });
            }
            return memo;
        /* every time is a different association, no link across posts
         * but has to change and don't take a randomized input. rather
         * a random seed client-generated, so client side user can
         * recognize herself in the graph, because UX will highlight */
        }, {
          pseudonym: utils.numId2Words([ _.random(1, info.userId) ]),
          stats: []
        });
    })
    .then(function(layered) {
        var flat = _.flatten(_.map(layered, function(l) {
            return l.stats;
        }));
        debug("realityMeter: Got %d input points for %d users",
            _.size(flat), _.size(layered));
        return { 'json': flat };
    })
    .catch(function(error) {
        console.error(error);
        return { 'error': 'some error happen!'};
    });
};


/* take last $N refreshes and $Y first post per refresh */
var userTimeLine = function(req) {
    var numId = _.parseInt(req.params.userId);
    var past = _.parseInt(req.params.past);
    var refreshes_N = _.parseInt(req.params.R);
    var posts_N = _.parseInt(req.params.P);

    if(_.every(numId, past, refreshes_N, posts_N), !_.isNaN)
        throw new Error("Invalid request");

    debug("%s userTimeLine user %d (Ref %d, Posts %d) offset %d",
        req.randomUnicode, numId, refreshes_N, posts_N, past);

    /* if not the same of the default, log it as anomaly/good to know */
    var retVal = { 'json' : {} };

    return Promise.all([
        mongo.readLimit(nconf.get('schema').refreshes,
                    { userId: numId },
                    { refreshTime: -1 },
                    refreshes_N, past ),
        mongo.countByObject(nconf.get('schema').refreshes, {userId:numId })
    ])
    .then(function(results) {
        /* side effects */
        retVal.json.refreshAvailable = _.tail(results);
        retVal.json.refreshes = utils.stripMongoId(_.first(results));
        /* only the refreshes are map-ped below */
        return _.first(results);
    })
    .map(function(refresh) {
        return mongo
            .readLimit(nconf.get('schema').timeline, 
                        {refreshId: refresh.refreshId},
                        {order: 1}, posts_N, 0);
    })
    .map(utils.stripMongoId)
    .then(function(timelines) {
        retVal.json.timelines = timelines;
        return retVal;
    });
};

function manualBoarding(req) {

    var userId = _.parseInt(req.body.userId);
    var publicKey = req.body.publicKey;
    var password = req.body.password;
    var userSecret = _.random(0, 0xffff);

    debug("%s manualBoarding on user %d publicKey %s",
        req.randomUnicode, userId, publicKey);

    if(!_.eq(password, nconf.get('password'))) {
        debug("Wrong password supply (%s)", password);
        return { 'json': { 'result': 'wrong password?' }};
    }

    return mongo.read(nconf.get('schema').supporters, {
        userId: userId,
        publicKey: publicKey
    })
    .then(function(existing) {
        var content = {
            userId: userId,
            publicKey: publicKey,
            userSecret: userSecret,
            keyTime: new Date(moment().toISOString()),
            lastActivity: new Date(moment().toISOString())
        };
        if (_.size(existing)) {
            debug("ignored manualBoarding: existing user! %j", existing);
            return { 'json': { 'result': 'Error', info: existing }};
        } else {
            return mongo
                .writeOne(nconf.get('schema').supporters, content);
        }
    })
    .then(function(result) {
        debug("manualBoarding: %j", result);
        return { 'json': { 'result': 'OK' }};
    });
};

function getAlarms(req) {

    var dayback = _.parseInt(req.params.dayback);

    debug("getAlarms back of %d days", dayback);

    return mongo.read(nconf.get('schema').alarms, {
        when: { "$gt": new Date(moment().subtract(dayback, 'd').toISOString()) }
    })
    .then(function(alarms) {
        return { json: alarms };
    });
}


module.exports = {
    nodeInfo: nodeInfo,
    countriesStats: countriesStats,
    userAnalysis: userAnalysis,
    postReality: postReality,
    postLife: postLife,
    userTimeLine: userTimeLine,
    manualBoarding: manualBoarding,
    getAlarms: getAlarms
};
