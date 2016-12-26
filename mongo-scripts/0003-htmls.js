#!/usr/bin/env nodejs
var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('0003-htmls');
var moment = require('moment');
var nconf = require('nconf');

var mongo = require('../lib/mongo');
var hash = require('../lib/utils').hash;

var cfgFile = "config/settings.json";
nconf.argv().env().file({ file: cfgFile });

function redoHtml56(slotN) {

    debug("Iterating over slot %d", slotN);
    var first = slotN * 10000;

    return mongo
        .readLimit('htmls', {}, {}, 10000, first)
        .tap(function(x) {
            debug("the html list is %d", _.size(x));
        })
        .map(function(incomplete, i) {

            var html = _.pick(incomplete, ['savingTime', 'html', 'id' ]);
            html.savingTime = new Date(html.savingTime);

            if(i % 1000 === 0)
                debug("%d", i);

            return mongo
                .read('impressions2', { htmlId: html.id })
                .then(_.first)
                .then(function(imp) {

                    if(!imp) {
                        debug("Inconsistency? %s missing", html.id);
                        return;
                    }

                    html.userId = imp.userId;
                    html.timelineId = imp.timelineId;
                    html.impressionId = imp.id;
                    return html;
                });
        }, {concurrency: 4})
        .then(_.compact)
        .then(function(block) {
            debug("saving %d-%d size %d", first, first + 10000, _.size(block));
            if(_.size(block))
                return mongo.writeMany('htmls2', block);
        });
};


/* this conversion has to cover: htmls.
 * Tasks:
 *
 *   5 html.userId, .timelineId, .impressionId has to be added 
 *   6 html metadata has to be removed and recomputed
 */
 
return Promise.each(_.times(7), redoHtml56);
