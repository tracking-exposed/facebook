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
[ '',
  'photos',
  'a.2044902392402301.1073741828.2032149717010902',
  '2154377274788145', <---- we need this
  '' ]
     */
    try {
        return _.parseInt(href.match(/\/photos\/.\.\d+.\.\d+\.\d+\/\d+\//)[0].split('/')[3]);
    } catch (err){
		// debug("Error", err);
        return null;
    }
}

function tryPost(href) {
    try {
        return _.parseInt(href.match(/posts\/\d+/)[0].split('/')[1]);
    } catch (err) {
		// debug("Error", err);
		return null;
    }
}


function getPostCore(href) {

    var retVal = null;
    var postTypes = {
        post: tryPost,
     //   album: tryAlbum,
        photo: tryPhoto,
     //   invite: tryEvent
    };

	debug("testing", href);
    _.each(postTypes, function(extractor, postTypef) {
		debug("try %s", postTypef);
        var check = extractor(href);
        if(check) {
			if(retVal)
				debug("retVal assigned? %j", retVal);
            retVal = { postId: check, type: postTypef };
		}
    });
    return retVal;

    /*
    if ( href.match(/\/posts\//)) ) {
        
    } else if ( href.match(/\/events\//) ) {
    } else if ( href.match(/\/notes\//) ) {
    } else if ( href.match(/\/photos\//) ) {
    } else {
        return null;
    }
*/
        return null;
};

function getPostBI(snippet) {

    var $ = cheerio.load(snippet.html);
    var href = $('.timestampContent').parent().parent().attr().href;
    debugger;
    // parent of timestampContent
    // abbr elem with data-utime as attr
    // element a parent of the <abbr>

    if(_.isUndefined(href)) {
        debug("%s ∅", snippet.id);
        return { 'feedPostHref': false };
    }

    var postCore = getPostCore(href);
    if(!postCore) {
        debug("%s ∅∅", snippet.id);
        return { 'feedPostHref': false };
    }

    debug("%s\n  ≻  %s", snippet.id, href);
    return { 'feedBasicInfo': true, 
             'publicationUTime': postCore.utime,
             'postId': postCore.postId,
             'permaLink': href,
             'hrefType': postCore.type // ['photo','post']
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
