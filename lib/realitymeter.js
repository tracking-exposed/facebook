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

function postReality(req) {
    var postId = _.parseInt(req.params.postId);
    if(_.isNaN(postId))
        throw new Error("not a postId received?");

    var filter = {};
    var group = {
        _id: { postId: "$postId", count: { "$add": 1 } },
        users: { $addToSet: "$userId" },
        times: { $addToSet: "$savingTime" } 
    };
    return mongo
        .aggregate(nconf.get('schema').htmls, filter, group)
        .then(function(xxx) {
            debug("%s", xxx);
            return xxx;
        })
};

/* same */
var x = function(req) {
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


module.exports = {
    postReality: postReality,
    postLife: postLife,
};
