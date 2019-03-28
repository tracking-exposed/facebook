#!/usr/bin/env node
var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('0002-timelines-impressions');
var moment = require('moment');
var nconf = require('nconf');

var mongo = require('../lib/mongo');
var hash = require('../lib/utils').hash;

var cfgFile = "config/settings.json";
nconf.argv().env().file({ file: cfgFile });

function redoTimelines1(good) {
    return mongo
        .read('timelines', {})
        .map(function(te) {
            te.userId = _.parseInt(te.userId);
            te = _.omit(te, ['_id']);
            return {
                'entry': te,
                'memo': {
                    timelineId: te.id,
                    userId: te.userId
                }
            };
        })
        .then(function(rez) {
            /* error --- this is copying a string, but in fase 0004 get fixed */
            var tbs = _.map(rez, function(o) {
                return o.entry;
            });
            var inher = _.map(rez, function(o) {
                return o.memo;
            });
            return Promise
                .map(tbs, function(toBeSaved) {
                    return mongo
                        .read('timelines2', {id: toBeSaved.id})
                        .then(_.first)
                        .then(function(e) {
                            if(e.id !== toBeSaved.id) {
                                return mongo.writeOne('timeline2', toBeSaved);
                            } else {
                                debug("Skipping duplicate");
                            }
                        });
                }, {concurrency : 1} )
                .return(inher);
        });
};

function redoImpressions34(tmlc) {
    /* this require a brutefore: the UUIDv4 hashed with the userId cause the timelineId, but 
     * I've not an association */

    var userList = _.uniq(_.map(tmlc, 'userId'));
    return mongo
        .read('impressions', {})
        .tap(function(impl) {
            debug("Estimated size %d * %d = %d",
                _.size(impl), _.size(userList), 
                _.size(impl) * _.size(userList) );
        })
        .map(function(imp, i) {
            var uuid = imp.timelineId;

            if(i % 1000 === 0)
                debug("%d", i);

            return _.reduce(userList, function(memo, u) {

                var pre = _.find(memo, { uuid: uuid });
                if(pre)
                    return memo;

                var h = hash({
                    'uuid': uuid,
                    'user': u
                });
                var check = _.find(tmlc, { timelineId : h });
                if(check) {
                    memo.push({ uuid: uuid, user: u, hash: h  });
                }
                return memo;
            }, []);
        })
        .then(function(impl) {
            var impc = _.size(impl);
            var flat = _.flatten(impl);
            debug("before flat %d after %d diff (non-feed?) %d", 
                    impc,
                    _.size(flat),
                    impc - _.size(flat) );
            return flat;
        })
        .then(function(full) {
            debug("Size then: %s", _.size(full));

            return mongo
                .read('impressions', {})
                .map(function(uncleanI, i) {

                    var impression = _.pick(uncleanI, ['impressionOrder', 'visibility', 'impressionTime', 'htmlId']);
                    impression.impressionTime = new Date(impression.impressionTime);

                    var M = _.find(full, { uuid: uncleanI.timelineId });
                    if(!M) {
                        debug("Hash rebuilder fail on %d", i);
                        return null;
                    }

                    impression.timelineId = M.hash;
                    impression.userId = M.user;
                    impression.id = hash({
                        'uuid': M.uuid,
                        'user': impression.userId,
                        'order': impression.impressionOrder
                    });

                    if(i < 3)
                        debug("check %s", JSON.stringify(impression, undefined, 2));

                    return impression;
                });
        })
        .then(_.compact)
        .then(function(result) {
            debug("completed %d new impressions", _.size(result));
            return mongo.writeMany('impressions2', result);
        });
};

/* this conversion has to cover: timelines, impressions.
 *
 * Tasks:
 *   1 timelines.userId (String) has to be timelines.userId (Int)
 *   2 timelines.nonfeed = true; is used when no impressions are available
 *
 *   3 impressions.timelineId is the uuid, has to be hashed with (all the) userId, found the proper timeline, linked.
 *   4 impressions.userId has to be put
 *
 */
return Promise.resolve()
    .then(redoTimelines1)
    .then(redoImpressions34);
