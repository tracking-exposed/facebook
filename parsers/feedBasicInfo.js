#!/usr/bin/env nodejs
var _ = require('lodash');
var cheerio = require('cheerio');
var moment = require('moment');
var debug = require('debug')('feedBasicInfo');
var parse = require('./lib/parse');

function tryPhoto(href) {
    /* 
> t.match(/\/photos\/.\.\d+.\.\d+\.\d+\/\d+\//)
[ '/photos/a.2044902392402301.1073741828.2032149717010902/2154377274788145/',
  index: 22,
  input: '/sustainabledirections/photos/a.2044902392402301.1073741828.2032149717010902/2154377274788145/?type=3' ]
> t.match(/\/photos\/.\.\d+.\.\d+\.\d+\/\d+\//)[0].split('/')
[ '', 'photos', 'a.2044902392402301.1073741828.2032149717010902',
  '2154377274788145', <---- we need this                     ,'']
     */
    try {
        return _.parseInt(href.match(/\/photos\/.\.\d+.\.\d+\.\d+\/\d+\//)[0].split('/')[3]);
    } catch (err){
    }

		/*
		https://www.facebook.com/photo.php?fbid=10209913340943131&set=a.10205966341230605.1073741826.1622311740&type=3
		> href.match(/fbid=\d+.&/)
		[ 'fbid=10209913340943131&' ]
		> _.trim(href.match(/fbid=\d+.&/)[0], 'fbid=&')
		'10209913340943131'
		*/
    try {
        return _.parseInt(_.trim(href.match(/fbid=\d+.&/)[0], 'fbid=&'));
    } catch(err) {
    }
}

function tryPost(href) {
    try {
        return _.parseInt(href.match(/posts\/\d+/)[0].split('/')[1]);
    } catch (err) {
    }
}

function tryGroupPost(href) {
    /*
    '/groups/sangottardomedamontegani/permalink/1229337840477063/'.split('/')
    [ '',
      'groups',
      'sangottardomedamontegani',
      'permalink',
      '1229337840477063',
      '' ]
    */
    try {
        var chunks = href.split('/');
        if(chunks[1] === 'groups' && chunks[3] === 'permalink')
            return _.parseInt(chunks[4]);
    } catch(err) {
    }
}

function tryVideo(href) {
    /* /curbedla/videos/1251246371591956/ */
    try {
        var chunks = href.split('/');
        if(chunks[2] === 'videos')
            return _.parseInt(chunks[3]);
    } catch(err) {
    }
}

function tryEvent(href) {
    /*  /events/359002347809512/permalink/360906750952405/?r...  */
    try {
        var chunks = href.split('/');
        if(chunks[1] === 'events' && chunks[3] === 'permalink')
            return _.parseInt(chunks[4]);
    } catch(err) {
    }
}

function tryNotes(href) {
    /* /notes/anna-legge/la-signora-culosodo-e-le-sue-molte-letture/1637460316563813/ */
    try {
        var chunks = href.split('/');
        if(chunks[1] === 'notes')
            return _.parseInt(chunks[4]);
    } catch(err) {
    }
}

function tryAlbum(href) {
    /* https://www.facebook.com/media/set/?set=a.156035371537982.1073741837.100013945592641&type=3 */
    try {
        return _.parseInt(_.trim(href.match(/set=a\.\d+.\./)[0], 'set=a.'));
    } catch(err) {
    }
}


function getPostCore(htmlId, href) {

    var retVal = null;
    var postTypes = {
        post: tryPost,
        photo: tryPhoto,
        groupPost: tryGroupPost,
        video: tryVideo,
        event: tryEvent,
        notes: tryNotes,
        album: tryAlbum
    };

    _.each(postTypes, function(extractor, postTypef) {

        if(!(retVal && retVal.type === 'photo' && postTypef === 'album'))
            var foundpId = extractor(href);

        if(foundpId) {

            if(retVal) {
                debug("already assigned? %j (new %d %s)",
                    retVal, foundpId, postTypef);
                debug("conflict in %s %s", htmlId, href);
            }

            if(!_.isInteger(foundpId))
                debug("øøø !! %s %s", htmlId, href);
            else
                retVal = { postId: foundpId, type: postTypef };
        }
    });
    return retVal;
};

function getPostBI(snippet) {

    var $ = cheerio.load(snippet.html);

    try {
        var href = $('.timestampContent').parent().parent().attr().href;
        // parent of timestampContent
        // abbr elem with data-utime as attr
        // element a parent of the <abbr>
        if(_.isUndefined(href)) {
            debug("ø undefined href? %s", snippet.id);
            return { 'feedBasicInfo': false };
        }
    } catch(err) {
        debug("øø unable to get href! %s", snippet.id);
        return { 'feedBasicInfo': false };
    }

    var postCore = getPostCore(snippet.id, href);
    if(!postCore) {
        debug("øøø %s → %s ", href, snippet.id);
        return { 'feedBasicInfo': false };
    }

    // debug("%s ≻  %s %s", snippet.id, postCore.type, href);
    return {
        feedBasicInfo: true, 
        postId: postCore.postId,
        permaLink: href,
        hrefType: postCore.type
    };
};

var postHref = {
    'name': 'feedBasicInfo',
    'requirements': {'type': 'feed'},
    'implementation': getPostBI,
    'since': "2016-09-13",
    'until': moment().toISOString(),
};

return parse.please(postHref);


/* 
 * "/sustainabledirections/photos/a.2044902392402301.1073741828.2032149717010902/2148280472064492/?type=3" rel="theater" ajaxify="/sustainabledirections/photos/a.2044902392402301.1073741828.2032149717010
 *
 * https://www.facebook.com/2084online/posts/1340414852682111
 *
 * https://www.facebook.com/joana.varon/posts/10154308117673520?ref=3&action_history=null
 *
 * https://www.facebook.com/events/1374872899192516/permalink/1383884268291379/?ref=3&action_history=null
 *
 * INSTAGRAM
 *
 * <a class="_5pcq" href="https://www.facebook.com/photo.php?fbid=1611982902443533&amp;set=a.1501650293476795.1073741846.100008955168308&amp;type=3" rel="theater" ajaxify="https://www.facebook.com/photo.php?fbid=1611982902443533&amp;set=a.1501650293476795.1073741846.100008955168308&amp;type=3&amp;size=1080%2C608&amp;source=12&amp;player_origin=unknown" target=""><abbr title="Segunda, 19 de dezembro de 2016 às 11:44" data-utime="1482155081" data-shorten="1" class="_5ptz"><span class="timestampContent" id="js_dr0">19 de dezembro às 11:44</span></abbr></a>
 *
 * https://www.facebook.com/events/130962834057280/permalink/139790183174545/?ref=3&action_history=null
 *
 *
 * */
