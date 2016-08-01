// ==UserScript==
// @name         facebook.tracking.exposed
// @namespace    https://facebook.tracking.exposed
// @version      0.9.3
// @description  Collection meta-data from Facebook's timeline, in order to analyze and look for potential informative manipulation (if you've never heard about Filter Bubble, and you're still young⌁inside™, start here https://en.wikipedia.org/wiki/Filter_bubble )
// @author       Claudio Agosti @_vecna
// @match        https://www.facebook.com/*
// @connect      localhost:4444
// @connect      localhost
// @connect      facebook.tracking.exposed
// @grant        GM_xmlhttpRequest
// @require      https://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.13.0/moment.min.js
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/lodash-compat/3.10.2/lodash.min.js
// ==/UserScript==

var d = true, /* debug */
    ee = true; /* explicit in the page */

var rankByLocation = {},
    lastLocation = null,
    toBeFlush = [],
    reportCounter = 0,
    user = null,
    lastAnalyzedPost = null,
    STARTING_FRACTION = 300,
    lastTokenAvailable = 0,
    url =  'http://localhost:4444'; // url: 'https://facebook.tracking.exposed';


/* has to be called only when user is set */
var refreshToken = function() {
    userIsNeed();
    GM_xmlhttpRequest({
        method: "GET",
        url: url + '/token/2/feed/' + user.id,
        onload: function(response) {
            lastTokenAvailable = JSON.parse(response.response).token;
            if (d) console.log("Token retrieved " + lastTokenAvailable);
        }
    });
};

var extractInfoPromoted = function(nodehtml, postType) {

    var startHref = nodehtml.search(/href="https:\/\/www.facebook.com\//),
        hrefP = nodehtml.substring(startHref + 6).replace(/" .*/, '').replace(/"> .*/, '');

    return {
        href_stats: [ startHref ],
        href: hrefP,
        additionalInfo: null,
        utime: null, // _.parseInt(utime),
        type: postType,
        child: _.size($(nodehtml)[0].childNodes)
    };
};

var extractInfoFromFeed = function(nodehtml, postType) {

    if (_.size(nodehtml) < 300) {
        if (d) console.log("node.innerHTML (expected a) " + postType + " skipped: the size is less than 300 (" + _.size(nodehtml) + ")");
        return null;
    }

    for (var fraction = STARTING_FRACTION; fraction <= 550; fraction += 50) {

        var profileS = nodehtml.search(/profileLink/),
            profileDU = nodehtml.substring(profileS + 19, profileS + 100),
            profileHref = profileDU.replace(/".*/, '');

        var t = nodehtml.search(/timestampContent/),
            block = nodehtml.substring(t - fraction, t),
            hrefP = block.match(/href=".* /),
            utimeP = block.match(/data-utime=".*/);

        if (_.isNull(hrefP) || _.isNull(utimeP) )
            continue;

        var href = hrefP[0].replace(/" .*/, '').substr(6),
            utime = utimeP[0].replace(/"\ .*/, '').substr(12);

        if( href === '' || utime === '' )
            continue;

        return {
            /*
            href_stats: [ block.search(/href="/), fraction ],
            child: _.size($(nodehtml)[0].childNodes)
            */
            href: href,
            additionalInfo: (profileS !== -1) ? profileHref : null,
            utime: _.parseInt(utime),
            type: postType
        };
    }
    return null;
};

var extractPostType = function(nodehtml) {
    switch(_.size($(nodehtml)[0].childNodes)) {
        case 5:
            return('feed');
        case 3:
            return('related');
    }
    return('promoted');
};

var verboseEntry  = function(node, post, whichPost, fromWhere, pathname) {
    if (!ee) return;
    var tId = "X" + _.random(0x0000, 0xffff);
    html = [ '<small><div id="' + tId + '">', '<pre>', fromWhere, 'Now at[', whichPost, ']#', rankByLocation[pathname],
             post, 'is', JSON.stringify(_.omit(post, ['from']), undefined, 2), '</pre>', '</div></small>'];

    $(node).append(html.join(" "));
};

var hasToBeInitialized = function() {
    if(_.isUndefined(_.get(user, 'id')))
        return;

    var x = $("div > a");

    if(!_.size(x)) {
        if(d) console.log("Impossible find the user now...");
        return;
    }

    _.each(x, function(aElem, cnt) {
        var img = _.get($(aElem)[0], 'firstChild'),
            profile_id = _.get($(img)[0], 'id'),
            pattern = 'profile_pic_header_';
        console.log(profile_id);
        if (_.startsWith(profile_id, pattern)) {
            user = {
                id: profile_id.substring(_.size(pattern), _.size(profile_id)),
                href: aElem.href
            };
        }
    });

    if(_.isUndefined(_.get(user, 'id'))) {
        if(d) console.log("Impossible parse the users from " + _.size(x) + " html elements!?");
        return;
    }
    refreshToken();
    console.log("facebook.tracking.exposed initialization: Appending link near facebook logo, detected user: " + JSON.stringify(user) );
    $("h1")[0].innerHTML = "<a id='FTE' target='_blank' href='" + url + "/personal/" + user.id  + "' " +
        "style='vertical-align:top;font-size:2em;font-weight:bold;top:5px;max-height:25px;color:palegreen'>↺</a>";
    /* find someone able to implement properly the issue #1 */
};

var newUserContent = function(jNode) {
    var node = jNode[0],
        pathname = document.location.pathname;

    if (_.get(node, 'attributes[2].nodeName') !== 'aria-label')
        return;

    hasToBeInitialized();

    /* this fit new location or locantion changes */
    if (pathname !== lastLocation) {
        var lse = {
            'collected': _.size(toBeFlush),
            'why': 'location_switch',
            'from': lastLocation,
            'reach': rankByLocation[lastLocation],
            'new': pathname,
            'when': moment().format()
        };
        rankByLocation[pathname] = 0;
        appendLog(lse);
        verboseEntry(jNode, lse, "last location -> " + lastLocation, "LocationSwitchEvent", pathname);
    }

    lastLocation = pathname;

    var logEntry = {
        'location' : pathname,
        'when' : moment()
    };

    var postType = extractPostType(node.innerHTML);

    if ( postType === 'feed' ) {
        feedPost = extractInfoFromFeed(node.innerHTML, postType);
        verboseEntry(jNode, lastAnalyzedPost, "previous", "Feed", pathname);
        appendLog(lastAnalyzedPost);
        logEntry.order = rankByLocation[pathname] = (rankByLocation[pathname] + 1);
        logEntry.content = [ feedPost ];
        lastAnalyzedPost = logEntry;
        verboseEntry(jNode, lastAnalyzedPost, "recorded Feed", "Feed", pathname);
    } else if ( postType === 'promoted' ) {
        promotedPost = extractInfoPromoted(node.innerHTML, postType);
        verboseEntry(jNode, lastAnalyzedPost, "previous", "Promoted", pathname);
        appendLog(lastAnalyzedPost);
        if(!_.isNull(promotedPost)) {
            logEntry.order = rankByLocation[pathname] = (rankByLocation[pathname] + 1);
            logEntry.content = [ promotedPost ];
            lastAnalyzedPost = logEntry;
            verboseEntry(jNode, lastAnalyzedPost, "recorder Promoted", "Promoted", pathname);
        } else {
            verboseEntry(jNode, null, "_.isNull this!", "Promoted", pathname);
            lastAnalyzedPost = null;
        }
    } else if ( postType === 'related') {
        postInfo = extractInfoFromFeed(node.innerHTML, postType);
        if (!_.isNull(lastAnalyzedPost) && !_.isUndefined(_.get(lastAnalyzedPost, 'content')) ) {
            verboseEntry(jNode, lastAnalyzedPost, "previous", "Related", pathname);
            lastAnalyzedPost.content[0].type = 'friendlink';
            lastAnalyzedPost.content[1] = postInfo;
        } else {
            verboseEntry(jNode, null, "previous isNull?", "Related/Broken", pathname);
            logEntry.order = rankByLocation[pathname] = (rankByLocation[pathname] + 1);
            logEntry.content = [ postInfo ];
            logEntry.content.type = 'broken';
            lastAnalyzedPost = logEntry;
        }
        verboseEntry(jNode, lastAnalyzedPost, "committing this", "Related (friend)", pathname);
        appendLog(lastAnalyzedPost);
        lastAnalyzedPost = null;
    } else {
        if (d) console.log("Parsing of this node didn't success, counter is: " + rankByLocation[pathname]);
        verboseEntry(jNode, lastAnayzedPost, "Previous", postType, pathname);
        appendLog(lastAnalyzedPost);
        lastAnalyzedPost = null;
    }
};

var appendLog = function(entryDict) {
    if(!_.isNull(entryDict)) {
        entryDict.counter = reportCounter;
        reportCounter +=1;
        toBeFlush.push(entryDict);
    }
};

var FLUSH_INTERVAL = 10000;

var checkToFlush = function() {

    hasToBeInitialized();

    if(_.size(toBeFlush)) {
        var envelope = { from: user, content: toBeFlush, token: lastTokenAvailable };
        if (d) console.log(envelope);
        if (d) console.log("After " + FLUSH_INTERVAL + "ms, at: " + moment() + ", " + toBeFlush.length + " info to be sent");
        GM_xmlhttpRequest({
            method: "POST",
            url: url + '/F/2',
            headers: { "Content-Type": "application/json" },
            data: JSON.stringify(envelope),
            onload: function(response) {
                if (d) console.log("Received response of XHR: " + response.response);
            }
        });
        toBeFlush = [];
    } else {
        console.log("The post queue is empty");
    }
    refreshToken();
    setTimeout (checkToFlush, FLUSH_INTERVAL);
};

var scrollTimeout = 0,
    whereScroll = 0,
    refreshTimes = 1,
    height = window.innerHeight !== undefined ? window.innerHeight : document.documentElement.offsetHeight,
    maxScrollTimes = 80;

var scrollDown = function() {
    /* has to be enabled somehow */
    if(scrollTimeout === 0)
        return;

    scrollTimeout = 4000;
    whereScroll += _.random(400, height) + (height * refreshTimes);

    if(_.random(1, 100) === 42) {
        scrollTimeout = scrollTimeout * 30;
        if (d) console.log("MASSIVE delay is happening, timeout to " + scrollTimeout + " scrolled " + refreshTimes + " times, limit " + maxScrollTimes);
    } else if(_.random(1,6) === 4) {
        scrollTimeout = 4000 * _.random(4, 20);
        if (d) console.log("Random happen, timeout to " + scrollTimeout + " scrolled " + refreshTimes + " times, limit " + maxScrollTimes);
    }

    if(refreshTimes >=  maxScrollTimes ) {
        appendLog({ 'why': 'auto_refresh', 'from': location, 'when' : moment(), 'auto_scroll': refreshTimes });
        location.reload();
        // implicit, reinit the variables here
    } else {
        refreshTimes += 1;
        if (d) console.log("scroll to " + whereScroll + " next scroll at: " + scrollTimeout);
        scrollTo(0, whereScroll);
        setTimeout(scrollDown, scrollTimeout);
    }
};

(function() {
    'use strict';
    waitForKeyElements ("div .userContentWrapper", newUserContent);
    setTimeout (checkToFlush, FLUSH_INTERVAL);
    setTimeout (scrollDown, scrollTimeout);
})();
