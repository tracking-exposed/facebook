const _ = require('lodash');
const debug = require('debug')('parsers:components:feed_id');
const helper = require('./utils/helper');
const moment = require('moment');

/* XXX bug

parsers:components:feed_id longId2 42 fbfeed_sub_header__id_2170246229744964:5:0 +0ms
  parsers:components:feed_id not the right format? (TypeError: Cannot read property 'split' of undefined

   */


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

    let dynamic1 = envelop.jsdom.querySelectorAll('div[id*="feed_subtitle_"]');
    let dynamic2 = envelop.jsdom.querySelectorAll('[id^="fbfeed_"]');

    if(!_.size(dynamic1) && !_.size(dynamic2))
        return null;

    if( _.size(dynamic1) > 1 || _.size(dynamic2) > 1 ||
      ( _.size(dynamic1) == 1 && _.size(dynamic2) == 1) ) {
        helper.notes(envelop, 'feed_id numbers 1', _.map(dynamic1, function(e) {
            return helper.getOffset(envelop, e);
        }));
        helper.notes(envelop, 'feed_id numbers 2', _.map(dynamic2, function(e) {
            return helper.getOffset(envelop, e);
        }));
        debug("*** [conflict?]: taking only the first among: *%j (%j)", dynamic1, dynamic2);
        dynamic1 = _.first(dynamic1);
    }

    dynamic1 = _.first(dynamic1);
    dynamic2 = _.first(dynamic2)
    let rv = {};
    // THIS DUPLICATION IS SAVAGE BUT IT IS A RESEARCH IN PROGRESS genau
    if(dynamic1) {
        let t1 = buildPermaLink(dynamic1, envelop);
        const longId1 = dynamic1.getAttribute('id');
        debug("longId1 %d\t%s", _.size(longId1), longId1);
        let at1 = testTwice(longId1, envelop);
        debug("1 - %j", [t1, at1 ]);
        rv = _.merge(t1, at1);
    }

    if(dynamic2) {
        let t2 = buildPermaLink(dynamic2, envelop);
        const longId2 = dynamic2.getAttribute('id');
        debug("longId2 %d\t%s", _.size(longId2), longId2);
        let at2 = testTwice(longId2, envelop);
        debug("2 - %j", [t2, at2 ]);
        rv = _.merge(t2, at2);
    }

    return rv;
}

function buildPermaLink(dynamic, envelop) {

    var permaLink = null;
    var linkedText = null;
    if(!dynamic)
        return { permaLink, linkedText };

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

    return { permaLink, linkedText };
}

function testTwice(longId, envelop) {

    let retval = commonFormat(longId);
    if(!retval) {
        retval = uncommonFormat(longId);
        debug("(un)commonFormat -> %j", retval);
        helper.notes(envelop, 'feed_id', { 'second': retval });
    } else {
        debug("commonFormat -> %j", retval);
        helper.notes(envelop, 'feed_id', { 'first': retval });
    }

    return retval;
};

module.exports = feed_id;
