const _ = require('lodash');
const debug = require('debug')('parsers:meaningfulId');
const helper = require('./helper');
const moment = require('moment');

function attributeLinkType0(sectionlist, retval) {
    const nth = 0;
    const chunk = _.nth(sectionlist, nth);

    if(chunk == 'groups') {
        retval.fblinktype = 'groups';
        retval.groupId = _.nth(sectionlist, nth +1);
        retval.infotype = _.nth(sectionlist, nth +2);
        retval.authorId = _.nth(sectionlist, nth +3);
        return true;
    } else if(chunk == 'stories') {
        retval.fblinktype = 'stories';
        retval.storyId = _.nth(sectionlist, nth +1);
        return true;
    } else if(chunk == 'events') {
        retval.fblinktype = 'events';
        debugger;
    } else if(chunk == 'watch') {
        retval.fblinktype = 'watch';
        retval.pageId = _.nth(sectionlist, nth +1);
        retval.detailId = _.nth(sectionlist, nth +2);
        return true;
    } else if(chunk == 'notes') {
        retval.fblinktype = 'notes';
        debugger;
    } else if(chunk == 'donate') {
        retval.fblinktype = 'donate';
        debugger;
    } else if(chunk == 'media') {
        retval.fblinktype = 'media';
        debugger;
    } else if(chunk == 'hashtag') {
        retval.fblinktype = 'hashtag';
        retval.hashtag = _.nth(sectionlist, nth +1);
        return true;
    } else if(chunk == 'ad_center') {
        retval.fblinktype = 'boost';
        return true;
    } else if(chunk == 'images') {
        retval.fblinktype = 'static';
        return true;
    }
    return false;
}

function attributeLinkType1(sectionlist, retval) {
    const nth = 1;
    const chunk = _.nth(sectionlist, nth);

    if(chunk == 'photos') {
        /* /MillenniumHiltonNewYorkOneUNPlaza/photos/a.415328151930706/1441157289347782/ */
        retval.fblinktype = 'photo';
        retval.groupId = _.nth(sectionlist, 0);
        retval.albumId = _.nth(sectionlist, nth +1).replace(/a\./, '');
        retval.authordId = _.nth(sectionlist, nth +2);
        return true;
    } else {
        retval.fblinktype = 'profile';
        retval.profileName = _.nth(sectionlist, 0);
        return true;
    }
}

function parseId(urlo) {
    const u = urlo.URLo; // comes from helper.updateHrefUnit
    if(u.hostname !== 'www.facebook.com')
        return null;

    const retval = { id: urlo.urlId };

    /* only facebook path now are selected */
    const chunks = _.compact(u.pathname.split('/'));

    /* analysis of the chunk in position 0 */
    let success = attributeLinkType0(chunks, retval);
    if(!success)
        success = attributeLinkType1(chunks, retval);
    return retval;
}

function findURLs(previous, objPath) {
    try {
        let urlcontainer = _.get(previous, objPath);
        let urlunits = _.filter(urlcontainer, 'urlId');
        return urlunits;
    } catch(e) {
        debug("Unexpected failure in attributing via %s", objPath);
    }
}

function meaningfulId(envelop, previous) {
    /* by looking at facebook links it look for meaningful ID that might be used to link publishers, page, etc .. */

    return _.compact(_.flatten(_.map(['hrefChains.hrefs', 'imageChains.images', 'profiles.profiles' ], function(p) {
        let urlobjs = findURLs(previous, p);
        return _.map(urlobjs, parseId);
    })));

}

module.exports = meaningfulId;