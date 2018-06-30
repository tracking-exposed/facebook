var _ = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('lib:tagId');
var moment = require('moment');
var nconf = require('nconf');
var fs = Promise.promisifyAll(require('fs'));

var utils = require('../lib/utils');
var mongo = require('../lib/mongo');


/* this used case is 'Barcellona' 

if(pattern)
    var re = new RegExp(pattern, 'i');
  ____ this goes in _.map(combos[0])
if(pattern) {
    var bool = html.html.match(re) ? true: false;
    _.set(x, pattern, bool);
}
 */

function acquireTimeline(timeline) {

    return Promise.all([
        mongo.read(nconf.get('schema').htmls, {
            timelineId: timeline.id,
            type: 'feed'
        }),
        mongo.read(nconf.get('schema').impressions, {
            timelineId: timeline.id
        })
    ])
    .then(function(combos) {
        return _.map(combos[0], function(html, i) {
            var x = _.find(combos[1], { htmlId: html.id });

            if(!x) return null;

            if(html.permaLink) {
                if(html.hrefType === "groupPost")
                    x.sourceId = html.permaLink.split('/')[2];
                else
                    x.sourceId = html.permaLink.split('/')[1];
            }

            x.geoip = timeline.geoip;
            x.publicationTime = moment(html.publicationUTime * 1000).toISOString();

            return _.merge(
                _.omit(x, ['_id', 'id', 'visibility', 'htmlId' ]),
                _.omit(html, ['_id', 'html', 'impressionId', 'postType',
                              'publicationUTime', 'feedUTime', 'type',
                              'feedText', 'feedHref', 'feedBasicInfo',
                              'imageAltText', 'savingTime' ])
            );
        });

    })
    .tap(function(x) {
        debug("getTimelines from %s timelineId: %d public impressions", timeline.id, _.size(x));
    });
}

/* the two exported functions */
function getTimelines(filter) {
    debug("getTimeline selected by %s (%s)",
            _.get(filter, 'userId') ? 'userId' : 'tagId',
            _.get(filter, 'userId') ? filter.userId : filter.tagId
    );
    return mongo
        .read(nconf.get('schema').timelines, filter, { startTime: -1 })
        .map(acquireTimeline, { concurrency: 1});
};

module.exports = {
    getTimelines: getTimelines
};
