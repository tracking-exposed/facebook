#!/usr/bin/env nodejs
var _ = require('lodash');
var cheerio = require('cheerio');
var moment = require('moment');
var debug = require('debug')('feedBasicInfo');
var verbose = require('debug')('v:postType');
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
        return href.match(/\/photos\/.\.\d+.\.\d+\.\d+\/\d+\//)[0].split('/')[3];
    } catch (err){
        verbose("1¹-Photo fail [%s]", href);
    }

		/*
		https://www.facebook.com/photo.php?fbid=10209913340943131&set=a.10205966341230605.1073741826.1622311740&type=3
		> href.match(/fbid=\d+.&/)
		[ 'fbid=10209913340943131&' ]
		> _.trim(href.match(/fbid=\d+.&/)[0], 'fbid=&')
		'10209913340943131'
		*/
    try {
        return _.trim(href.match(/fbid=\d+.&/)[0], 'fbid=&');
    } catch(err) {
        verbose("1²-Photo fail [%s]", href);
    }
}

function tryPost(href) {
    try {
        return href.match(/posts\/\d+/)[0].split('/')[1];
    } catch (err) {
        verbose("2-Post fail [%s]", href);
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
            return chunks[4];
    } catch(err) {
        verbose("3-GroupPost fail [%s]", href);
    }
}

function tryVideo(href) {
    /* /curbedla/videos/1251246371591956/ */
    try {
        var chunks = href.split('/');
        if(chunks[2] === 'videos')
            return chunks[3];
    } catch(err) {
        verbose("4-Video fail [%s]", href);
    }
}

function tryEvent(href) {
    /*  /events/359002347809512/permalink/360906750952405/?r...  */
    try {
        var chunks = href.split('/');
        if(chunks[1] === 'events' && chunks[3] === 'permalink')
            return chunks[4];
    } catch(err) {
        verbose("5-Event fail [%s]", href);
    }
}

function tryNotes(href) {
    /* /notes/anna-legge/la-signora-culosodo-e-le-sue-molte-letture/1637460316563813/ */
    try {
        var chunks = href.split('/');
        if(chunks[1] === 'notes')
            return chunks[4];
    } catch(err) {
        verbose("6-Notes fail [%s]", href);
    }
}

function tryAlbum(href) {
    /* https://www.facebook.com/media/set/?set=a.156035371537982.1073741837.100013945592641&type=3 */
    try {
        return _.trim(href.match(/set=a\.\d+.\./)[0], 'set=a.');
    } catch(err) {
        verbose("7-Album fail [%s]", href);
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

    _.each(postTypes, function(extractorf, postType) {

        if(!(retVal && retVal.type === 'photo' && postType === 'album'))
            var foundpId = extractorf(href);

        if(foundpId) {

            if(retVal) {
                debug("already assigned? %j (new %s %s)",
                    retVal, foundpId, postType);
                debug("conflict in %s %s", htmlId, href);
            }

            /*
            > foundpId.match(/\d+/)
            [ '10156056604079165', index: 0, input: '10156056604079165' ]
            */
            var check = foundpId.match(/\d+/)
            if(_.size(check[0] != _.size(check.input)))
                debug("øøøø !! %s %s", htmlId, href);
            else {
                verbose("function %s success: %s", postType, foundpId);
                retVal = { postId: foundpId, type: postType };
            }
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
            debug("ø undefined href? %s, trying album", snippet.id);

            _.each($('a'), function(a) {
                if($(a).attr('href').match(/\/media\/set\/.set=a/)) {
                    href = $(a).attr('href');
                }
            });

            if(_.isUndefined(href))
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

    verbose("Result: %s, %s", postCore.type, postCore.postId);
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
