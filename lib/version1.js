var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:api-1');
var os = require('os');
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


/*
 * This is the alpha viz restored, is not very efficient but looks nice,
 * we'll have to figure out better visualization before the 1.0 release
 */
var getRefreshMap = function(req) {
    var numId = _.parseInt(req.params.userId);
    var timelinesN = _.parseInt(req.params.not);
    var impressionsN = _.parseInt(req.params.noi);

    if(_.every(numId, timelinesN, impressionsN), !_.isNaN)
        throw new Error("Invalid request");

    debug("%s getRefreshMap user %d (Ref %d, Posts %d)",
        req.randomUnicode, numId, timelinesN, impressionsN);

    var retVal = {};

    return mongo
        .readLimit(nconf.get('schema').timelines,
                    { userId: numId }, { startTime: -1 }, 6, 0)
        .then(_.reverse)
        .then(function(timelines) {
            /* because time is always an index, is more optimal shrink the reseach method between the last and the first timeline */
            return _.reduce(timelines, function(memo, timeline, i) {
                var prev = i - 1;
                if(memo[prev] && memo[prev].end === null)
                    memo[prev].end = new Date(timeline.startTime);

                memo.push({
                    id: timeline.id,
                    start: new Date(timeline.startTime),
                    end: null
                });

                return memo;
            }, []);
        })
        .then(function(incompl) {
            incompl[5].end = new Date(moment(incompl[5].start).add(10, 'm'));
            /* now they are complete */
            retVal.timelines = incompl;
            return incompl;
        })
        .map(function(lookfor, i) {
            return mongo
                .readLimit(nconf.get('schema').impressions, {
                    timelineId: lookfor.id }, { impressionOrder: 1
                }, 20, 0);
        })
        .then(function(impress) {
            retVal.impressions = impress;

            var uniqHtmls = _.map(_.uniqBy(_.flatten(impress), 'htmlId'), 'htmlId');
            debug("Querying over %d HTMLs unit", _.size(uniqHtmls));
            return Promise
                .map(uniqHtmls, function(htmlId) {
                    return mongo
                        .read(nconf.get('schema').htmls, { id: htmlId })
                        .then(_.first)
                        .then(function(unit) {
                            return _.omit(unit, ['_id', 'html' ]);
                        });
                })
        })
        .then(function(metadata) {
            retVal.metadata = metadata;
            return { json: retVal };
        });
};


function manualBoarding(req) {
    /* This is a kind of a special API */
    var userId = _.parseInt(req.query.userId);
    var publicKey = req.query.publicKey;
    var password = req.query.password;
    var userSecret = _.random(0, 0xffff);

    if(!(userId && publicKey && password))
        return { 'json': 'Missing parameter!' };

    debug("%s manualBoarding on user %d publicKey %s",
        req.randomUnicode, userId, publicKey);

    if(!_.eq(password, nconf.get('password'))) {
        debug("Wrong password (%s)", password);
        return { 'json': "wrong password?" };
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
            lastActivity: new Date(moment().toISOString()),
            manual: true
        };
        if (_.size(existing)) {
            debug("ignored manualBoarding: existing user! %j", existing);
            return { 'json': "it exists" };
        } else {
            debug("Doing manualBoarding for user %d", content.userId);
            return mongo
                .writeOne(nconf.get('schema').supporters, content)
                .return({ 'json': "OK" });
        }
    });
};

function getAlarms(req) {

    debug("getAlarms (only 1 days history is kept by mongo)");

    return mongo
        .read(nconf.get('schema').alarms)
        .then(function(alarms) {
            debug("Retrived %d alarm",
                _.size(alarms));
            return { json: _.reverse(alarms) };
        });
}


module.exports = {
    nodeInfo: nodeInfo,
    countriesStats: countriesStats,
    userAnalysis: userAnalysis,
    getRefreshMap: getRefreshMap,
    manualBoarding: manualBoarding,
    getAlarms: getAlarms
};
