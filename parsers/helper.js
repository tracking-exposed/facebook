const _ = require('lodash');
const debug = require('debug')('parsers:utils:helper');
const querystring = require('querystring');
const moment = require('moment');

const utils = require('../lib/utils');

function updateHrefUnit(unit, sourceKey) {
    let thref = _.get(unit, sourceKey);
    if(_.startsWith(thref, '/'))
        _.set(unit, sourceKey, 'https://www.facebook.com' + thref );
    const bang = _.startsWith(thref, '#');
    try {
        if(!bang) {
            unit.URLo = new URL(_.get(unit, sourceKey));
            unit.parsed = querystring.parse(unit.URLo.search);
            unit.urlId = utils.hash({ parsedURL: unit.URLo.toString()})
        }
    } catch(e) {
        debug("Unexpected error in URL parsing %s: %s", thref, e.message);
        throw e;
    }
    return unit;
}

function recursiveSize(e, memo) {
    const elementSize = _.size(e.outerHTML);
    const tagName = e.tagName;
    if(!tagName)
        return memo;
    const combo = elementSize + ''; // + '-' + tagName.substring(0, 5);
    if(!memo)
        return recursiveSize(e.parentNode, [ combo ]);
    memo.push(combo);
    return recursiveSize(e.parentNode, memo);
}
function sizeTreeResearch(e) {
    let sizes = [];
    sizes.push(recursiveSize(e));
}

function nextNode(node) {
    let r = node.parentNode;
    if(!r) throw new Error("Recursion fail");
    return r;
};
function recursiveQuery(startingNode, tagName) {
    let node = startingNode;
    try {
        while(node.tagName != _.toUpper(tagName) )
            node = nextNode(node);
    } catch(e) {
        debug("E: %s", e.message);
    }
    if(node.tagName != tagName)
        return null;
    debug("find! %s", node.tagName);
    return node;
}

module.exports = {
    /* new */
    updateHrefUnit,
    sizeTreeResearch,
    recursiveSize,
    recursiveQuery,
};

function decodeAndExtractURL(url) {
    /* @input
     *      "https://external.ffco3-1.fna.fbcdn.net/safe_image.php?d=AQC25ca_QPS1ZSIM&w=540&h=282&url=https%3A%2F%2Fstatic.nexilia.it%2Fnextquotidiano%2F2018%2F12%2Fcodroipo-asilo-mondo-piccoli-bambolotti-6.jpg&cfs=1&upscale=1&fallback=news_d_placeholder_publisher&_nc_hash=AQAzofsfngO9dL0U",
       1st we decodeURIComponent()
            "https://external.ffco3-1.fna.fbcdn.net/safe_image.php?d=AQC25ca_QPS1ZSIM&w=540&h=282&url=https://static.nexilia.it/nextquotidiano/2018/12/codroipo-asilo-mondo-piccoli-bambolotti-6.jpg&cfs=1&upscale=1&fallback=news_d_placeholder_publisher&_nc_hash=AQAzofsfngO9dL0U"
       2nd we pick `url` parameter
       @retval
            https://static.nexilia.it/nextquotidiano/2018/12/codroipo-asilo-mondo-piccoli-bambolotti-6.jpg
     */
    var params = querystring.parse(url);
    return params.url;
}

function stripURLqs(url, verbose) {
    var initialsize = _.size(url);

    /* a photo should be preserved of their photo.php?parameters= */
    if(url.match(/\/photo.php\?fbid/))
        return url;

    var newurl = url.replace(/\?.*/, '');

    if(verbose) {
        if( (_.size(newurl) * 8) < initialsize )
            debug("stripped meaningful block of query options (%d -> %d) %s",
                initialsize, _.size(newurl), newurl);
        else if( _.size(newurl) === initialsize )
            debug("size unchanged: %s", newurl);
        else
            debug("stripped option but condition to be watched! (%d -> %d) %s",
                initialsize, _.size(newurl), newurl);
    }
    return newurl;
};

function isFacebook(url) {
    var test = _.replace(url, /https?:\/\//, '').replace(/\/.*/, '');
    var fb1 = test.match(/facebook\.com/);
    var rv = ( !!fb1 || _.startsWith(url, '/') );
    // debug("isFacebook %s… ? [%s]", url.substr(0, 22), rv);
    return rv;
};

function isFacebookCDN(url) {
    var test = _.replace(url, /https?:\/\//, '').replace(/\/.*/, '');
    var fb2 = test.match(/fbcdn\.net/);
    // debug("isFacebookCDN %s… ? [%s]", url.substr(0, 22), !!fb2);
    return !!fb2;
};

function fbRelativeSplit(url) {
    const cleanUrl = stripURLqs(decodeURIComponent(url));
    const chunks = _.split(cleanUrl, '/');
    const rawchunks = _.split(url, '/');

    /* when someone is posting in a group, it looks like:
     * /groups/LaGastriteDiShy/permalink/1976549185792752/ 
     * [ '', 'groups', 'LaGastriteDiShy', 'permalink', '1976549185792752', '' ]    */
    if(chunks[1] === 'groups' && chunks[3] === 'permalink') {
        return {
            fblinktype: 'groups',
            permaLink: cleanUrl,
            postId: chunks[4],
            groupId: chunks[2]
        };
    }
    else if(chunks[2] === 'videos') {
        /* /curbedla/videos/1251246371591956/  */
        return {
            fblinktype: 'videos',
            permaLink: cleanUrl,
            postId: chunks[3],
            authorId: chunks[1]
        }
    }
    else if(chunks[1] === 'events' && chunks[3] === 'permalink') {
      /*  /events/359002347809512/permalink/360906750952405/?r...  */
        return {
            fblinktype: 'events',
            permaLink: cleanUrl,
            postId: chunks[4],
            eventId: chunks[2]
        }
    }
    else if(chunks[1] === 'events') {
      /* /events/1183355435167509/pending ? */
        return {
            fblinktype: 'events',
            permaLink: cleanUrl,
            eventId: chunks[2]
        };
    }
    else if(chunks[2] === 'posts') {
        /* /christiansurchi/posts/10152826377265399 */
        return {
            fblinktype: chunks[2],
            permaLink: cleanUrl,
            postId: chunks[3],
            authorId: chunks[1]
        }
    } else if(url.indexOf('story_fbid=') !== -1) {
        /* check the stofy_fbid=, it is not anyore just 'id=' */
        const qs = querystring.parse( decodeURIComponent(url).replace(/\/permalink\.php\?/, '') );
        const cleanedQs = _.pick(qs, ['story_fbid', 'id']);
        const stripDownQs = querystring.stringify(cleanedQs);
        debug("Managing a permalink with parameters (%s) -> (%s)", _.keys(qs), _.keys(cleanedQs) );
        return {
            fblinktype: 'posts', // this is attributed, "but"
            permaLink: stripDownQs,
            postId: qs.story_fbid,
            authorId: qs.id, 
        };
    }
    else if(chunks[2] === 'photos') {
        /* /MillenniumHiltonNewYorkOneUNPlaza/photos/a.415328151930706/1441157289347782/ */
        return {
            fblinktype: 'photo', // is not used chunks[2] to be consistent with facebookLink metadata
            permaLink: cleanUrl,
            postId: chunks[4],
            albumId: chunks[3].replace(/a\./, ''),
            authordId: chunks[1]
        };
    } else if(chunks[1] === 'notes') {
        /* [ '', 'notes', 'comune-di-montalto-di-castro', 'natale-insieme-gli-appuntamenti-del-fine-settimana', '2025581447528903', '' ] */
        return {
            fblinktype: chunks[1],
            permaLink: cleanUrl,
            postId: chunks[4],
            authorId: chunks[2],
            title: chunks[3]
        };
    } else if(chunks[1] === 'donate') {
        // /donate/2007717256156625/2007717269489957/
        return {
            fblinktype: chunks[1],
            permaLink: cleanUrl,
            postId: chunks[3],
            authorId: chunks[2],
        };
    } else if(chunks[1] === 'groups') {
        // Unmanaged URL type? /groups/bitcoinitalia/1393602834044441/
        return {
            fblinktype: 'groups',
            permaLink: cleanUrl,
            postId: chunks[3],
            groupId: chunks[2]
        };
    } else if(chunks[2] === 'timeline') {
        // Unmanaged URL type? /MaxjRichman/timeline/story
        // 9737345e57f0063f065a6cecc134f9465e6371d0
        const blob = querystring.parse(url);
        const postId = blob['hash'];
        return {
            fblinktype: 'announcement',
            postId,
            permaLink: url,
        };
    } else if(chunks[1] === 'topic') {
        // http://localhost:8000/revision/c040bcc0d1038b5d92026aa62d5135dc90718bc7
        // /topic/UEFA-Champions-League-Final/826293637424910
        return {
            fblinktype: chunks[1],
            authorId: chunks[2],
            postId: chunks[3],
            permaLink: cleanUrl,
        };
    } else if(chunks[1] == 'media' && chunks[2] == 'set') {
        // '/media/set/?set=a.1431052107034609&type=3&comment_id=110009866823951&comment_tracking=%7B%22tn%22%3A%22R%22%7D'
        //       albumId      ^^^^^^^^^^^^^^^^
        // c27dd24ca70944f615345c52b97a190bd259ba63
        const blob = querystring.parse(decodeURIComponent(url))
        const partialPath = '/media/set/?set';
        const partialpId = _.get(blob, partialPath);
        return {
            fblinktype: 'album',
            postId: partialpId.substr(2),
            permaLink: `${partialPath}=${partialpId}`
        };
    } else if(_.startsWith(rawchunks[2], '?__') || (_.size(chunks) === 2 && rawchunks[1].match(/\?__/)) ) {
        /* to check this, is not used chunks but `rawchunks` 'cose we should check also the stripped 
         * ?query=strings such as -> /ChristopherEricHudspeth/?__tn__  
         * d2c9b8127e75f5d1fcc369928a6bcf708360d6e3 spotted as part of openGraph linked authors,
         * the second condition happen here: 7121db92c4472f34e05486e0bf58b55069485762
         **/
        return {
            fblinktype: 'internal',
            permaLink: cleanUrl,
        };
    } else {
        debugger;
        throw new Error(`Unsupported url format ${url}`);
        // before I was retuning an 'unexpected' thing, but no. 
    }
};

function isFacebookLink(url) {
    /* the conditions are the same used below */
    const domain = url.replace(/https?:\/\//, '').replace(/\/.*/, '');
    const uri = url.replace(/https?:\/\//, '').replace(/.*facebook\.com\//, '');
    return (
        domain === 'l.facebook.com' || _.startsWith(uri, 'photo.php') || _.endsWith(domain, 'facebook.com') ||
        _.startsWith(url, '/') || _.startsWith(url, 'blob:https') || uri.indexOf('/?') !== -1
    );
}

function facebookLink(url) {
    /* check if is a photo or an external link, save in place */
    const domain = url.replace(/https?:\/\//, '').replace(/\/.*/, '');
    const uri = url.replace(/https?:\/\//, '').replace(/.*facebook\.com\//, '');

    if(domain === 'l.facebook.com') {
        const decoded = _.replace(decodeURIComponent(uri.replace(/.*\?/, '')), /^u=/, '');
        // debug("processing l.facebook.com link (%d -> %d)", _.size(uri), _.size(decoded));
        return {
            fblinktype: 'external',
            link: stripFBclid(decoded),
            isValid: _.startsWith(decoded, 'http')
        };
    } else if(_.startsWith(uri, 'photo.php')) { // 91d284738b0a36096bc9d0237632cf93d4ec6856
        const qs = querystring.parse(decodeURIComponent(uri.replace(/.*\?/, '')));
        const photoId = qs.fbid;
        // debug("photo link -> %s, photoId %s", uri, photoId);
        return {
            fblinktype: 'photo',
            permaLink: '/' + uri,
            postId: photoId
        };
    } else if(_.endsWith(domain, 'facebook.com')) {
        /* internal link, managed by the dedicated function: 335c2181e4a9833bc3d2e70ce67c638ecd9da15f */
        return fbRelativeSplit('/' + uri);
    } else if(_.startsWith(url, '/')) {
        debug("processing permaLink: %s…", url.substring(0, 30));
        /* fblinktype, permaLink, postId, authorName */
        return fbRelativeSplit(url);
    } else if(_.startsWith(url, 'blob:https')) {
        debug("found a video link (can't be really used, but we can find if two posts have the same video)");
        return {
            internalref: url,
            fblinktype: 'video',
        };
    } else if(uri.indexOf('/?') !== -1) {
        /* 'https://www.facebook.com/incibus.de/?__xts__%5 , note: match above in uri, split below on url */
        const page = url.split('/?');
        debugger; // please put a second check on the domain 
        return {
            permaLink: page[0],
            fblinktype: 'page',
        };
    } else {
        debug("uri %s || domain %s not clearly attributed", uri, domain);
        debugger;
        throw new Error(`Not a facebook link ${url}`);
    }
}

function extractDate(abbr) {
    let option1 = abbr.getAttribute('data-utime');
    let plausible = new Date(_.parseInt(option1) * 1000);

    if(plausible != "Invalid Date")
        return plausible;

    try {
        let option2 = abbr.parentNode.querySelector('abbr').getAttribute('title');
        // 91d284738b0a36096bc9d0237632cf93d4ec6856 pictures, format 26-02-2019 20:08
        let s = option2.split(" ");
        let date = s[0].split("-");
        let time = s[1].split(":");
        let inito = {
            day: date[0], month: _.parseInt(date[1]) -1, year: date[2],
            hours: time[0], minutes: time[1]
        };
        let m = moment.utc(inito);
        if(!m.isValid())
            return null;
        debug("Rare condition in extractDate: %j %s - %s",
            inito, m, new Date(m.toISOString()) );
        return new Date(m.toISOString());
    } catch(error) {
        debug("Not possible dig an hour! %s", error);
    }
    return null;
};

function extractPermaLink(a) {
    const url = a.getAttribute('href');
    return facebookLink(url);
};

function stripFBclid(link) {
    const chunks = _.split(link, '?');

    if(_.size(chunks) === 1)
        /* has not any ?option */
        return link;

    const params = _.join(_.tail(chunks), '&');
    const qs = querystring.parse(decodeURIComponent(params));
    const rebuilt = querystring.stringify(_.omit(qs, ['fbclid']));

    /* this condition happen if fbclid was the only params */
    if(_.size(rebuilt))
        return _.first(chunks) + '?' + rebuilt;
    else
        return _.first(chunks);
};

function indicator(envelop, kind, data) {
    // this collects indicators of 'adveritising', because facebook is getting deceptive
    if(_.isUndefined(_.get(envelop.indicators)))
        envelop.indicators = [];
    debug("Saving indicator of advertising [%s] = (%s)", kind, data);
    envelop.indicators.push({ kind, data });
};

function notes(envelop, kind, data) {
    // this collect info 
    if(_.isUndefined(_.get(envelop.notes)))
        envelop.notes = [];
    envelop.notes.push({ kind, data });
};

function getOffset(envelop, node) {
    const fo = envelop.impression.html.indexOf(node.outerHTML);
    const check = _.split(envelop.impression.html.indexOf, node.outerHTML);
    if(_.size(check) > 2)
        debug("Warning! getOffset returns %d but the matching pieces are more than 1!!", fo);
    return fo;
}
