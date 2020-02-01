const _ = require('lodash');
const debug = require('debug')('parsers:components:feed_id');
const helper = require('./utils/helper');
const moment = require('moment');

function commonFormat(longId) {
    const semic = longId.split(';');
    const authorId = semic[1];
    const postId = semic[3];
    // 'feed_subtitle_263;132476996783723;0;2278794365485298;1551082475:4823278839040427436:5:0:16808
    //                         userId         postId          utime
    try {
        const utime = semic[4].split(':')[0];
        const ms = _.parseInt(utime) * 1000;
        const when = new Date(ms);

        return {
            publicationTime: when,
            authorId,
            postId,
        };
    } catch(error) {
        debug("not the right format? (%s) %s", error, longId);
    }
};

function uncommonFormat(longId) {
    // feed_subtitle_100001127827460:2024308784283363,2024313357616239:EntPhotoNodeBasedEdgeStory:a:1:
    //                userId           photoId        altra photoId
    // {s:15:"tagged_user_ids";a:1:{i:100001144516407;i:100001144516407;}}::::1551823793:5)

    const semic = longId.split(':');
    const userId = _.last(semic[0].split('_'));
    if(_.size(userId) < 5) {
        debug("this [%s] do not contains an userId: interrupting", semic[0]);
        return null;
    }

    const photoId = semic[1] ? _.first(semic[1].split(',')) : "";
    if(_.size(photoId) < 5) {
        debug("this first [%s] don't look like a photoId: interrupting", semic[1]);
        return null;
    }

    const future = moment().add('10', 'years');
    const past = moment().subtract('10', 'years');

    const publicationTime = _.reduce(semic, function(memo, chunk) {
        var converted = _.parseInt(chunk) + "";
        if(_.size(converted) != _.size(chunk))
            return memo;

        var test = moment.unix(converted);
        if(test.isBefore(future) && test.isAfter(past))
            memo = new Date(test.toISOString());

        return memo;

    }, new Date("Invalid Date"));

    if(publicationTime == 'Invalid Date') {
        debug("Unable to find the date: interrupting");
        return null;
    }

    return {
        publicationTime,
        authorId: userId,
        postId: photoId,
        fblinktype: 'photo',
        permaLink: `/${userId}/photos/${photoId}`
    };
};

function feed_id(envelop) {

    var dynamic = envelop.jsdom.querySelectorAll('div[id*="feed_subtitle_"]');

    if(!_.size(dynamic))
        return null;
    else if(_.size(dynamic) == 1) {
        dynamic = _.first(dynamic);
    } else if(_.size(dynamic) > 1) {
        helper.notes(envelop, 'feed_id numbers', _.map(dynamic, function(e) {
            return helper.getOffset(envelop, e);
        }));
        debug("Possible shared: but taking only the first among: %d", _.size(dynamic));
        dynamic = _.first(dynamic);
    }

    var permaLink = null;
    try {
        let rawlink = dynamic.querySelector('a').getAttribute('href');
        permaLink = helper.stripURLqs(rawlink);

        linkedText = dynamic.querySelector('a').textContent;

        helper.notes(envelop, 'feed_id permaLink', { linkedText, permaLink } );
        if(permaLink.startsWith('/business/'))
            helper.indicator(envelop, 'Paid partnership');
    } catch(error) {
        debug("Test to pick a permaLink failed (%s)", error);
    }

    const longId = dynamic.getAttribute('id');

    let retval = commonFormat(longId);
    if(!retval) {
        retval = uncommonFormat(longId);
        debug("(un)commonFormat -> %j", retval);
        helper.notes(envelop, 'feed_id', { 'second': retval });
    } else {
        if(permaLink)
            retval.permaLink = permaLink;
        debug("commonFormat -> %j", retval);
        helper.notes(envelop, 'feed_id', { 'first': retval });
    }

    return retval;
};

module.exports = feed_id;
