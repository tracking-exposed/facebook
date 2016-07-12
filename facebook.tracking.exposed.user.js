// ==UserScript==
// @name         facebook.tracking.exposed
// @namespace    https://facebook.tracking.exposed
// @version      0.9.1
// @description  Collection data on timeline sorting, to analyze and extract evidence in (potential) user manipulation.
// @author       Claudio Agosti @_vecna
// @match        https://www.facebook.com/*
// @connect      facebook.tracking.exposed
// @connect      localhost
// @grant        GM_xmlhttpRequest
// @require      https://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.13.0/moment.min.js
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/lodash-compat/3.10.2/lodash.min.js
// ==/UserScript==

/* ----
   references:
   http://www.wsj.com/articles/fears-of-facebook-bias-seem-to-be-overblown-1463371261
   https://medium.com/message/ferguson-is-also-a-net-neutrality-issue-6d2f3db51eb0
   --- */

var d = false, /* debug */
    ee = false; /* explicit in the page */

var rankByLocation = {},
    lastLocation = null,
    toBeFlush = [],
    reportCounter = 0,
    user = null,
    lastAnalyzedPost = null,
    STARTING_FRACTION = 300;


var getUserId = function() {
    var x = $("div > a");

    _.each(x, function(aElem, cnt) {
        var img = _.get($(aElem)[0], 'firstChild'),
            profile_id = _.get($(img)[0], 'id'),
            pattern = 'profile_pic_header_';

        if (_.startsWith(profile_id, pattern)) {
            user = {
                id: profile_id.substring(_.size(pattern), _.size(profile_id)),
                href: aElem.href
            };
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
    if (_.size(nodehtml) < 300)
        return null;

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
     html = [ '<div id="' + tId + '">', '<pre>', fromWhere, 'Now at[', whichPost, ']#', rankByLocation[pathname],
              post, 'is', JSON.stringify(_.omit(post, ['from']), undefined, 2), '</pre>', '</div>'];

     $(node).append(html.join(" "));
 };

var newUserContent = function(jNode) {
    var node = jNode[0],
        pathname = document.location.pathname;

    if (_.get(node, 'attributes[2].nodeName') !== 'aria-label')
        return;

    if (_.isNull(user))
        getUserId();

    if (_.isNull(user)) {
        alert("facebook.tracking.exposed message: Disable the script, because seems doesn't work in your condition. If you feel, notice the author.");
        return;
    }

    /* this fit new location or locantion changes */
    if (pathname !== lastLocation) {
        appendLog({'why': 'location_switch', 'from': lastLocation, 'reach': rankByLocation[lastLocation], 'new': pathname});
        rankByLocation[pathname] = 0;
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
            verboseEntry(jNode, null, "previous isNull -- I'm supposed to to an update", "Related/Broken", pathname);
            logEntry.order = rankByLocation[pathname] = (rankByLocation[pathname] + 1);
            logEntry.content = [ postInfo ];
            logEntry.content.type = 'broken';
            lastAnalyzedPost = logEntry;
        }
        verboseEntry(jNode, lastAnalyzedPost, "committing this", "Related (friend)", pathname);
        appendLog(lastAnalyzedPost);
        lastAnalyzedPost = null;
    } else {
        console.log("Unrecognized found when rank counter is: " + rankByLocation[pathname]);
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

var FLUSH_INTERVAL = 15000;
var checkToFlush = function() {
    if (_.size(toBeFlush)) {
        var envelope = { from: user, content: toBeFlush };
        if (true) console.log("After " + FLUSH_INTERVAL + "ms, at: " + moment() + ", " + toBeFlush.length + " info to be sent");
        GM_xmlhttpRequest({
           method: "POST",
           url: 'https://facebook.tracking.exposed/F/1',
            // url: 'http://localhost:4444/F/1',
            headers: { "Content-Type": "application/json" },
            data: JSON.stringify(envelope)
        });
        toBeFlush = [];
    }
    setTimeout (checkToFlush, FLUSH_INTERVAL);
};

var scrollInitialWaitTime = 4000,
    scrollTimeout = scrollInitialWaitTime,
    whereScroll = 0,
    refreshTimes = 1,
    height = window.innerHeight !== undefined ? window.innerHeight : document.documentElement.offsetHeight,
    maxScrollTimes = 60;

var scrollDown = function() {

      whereScroll = _.random(400, height) + (height * refreshTimes);
      if(scrollTimeout !== scrollInitialWaitTime) {
          scrollTimeout = scrollInitialWaitTime;
          console.log("Restoring timeout to " + scrollTimeout + " scrolled " + refreshTimes + " times, limit " + maxScrollTimes);
      }
      if(_.random(1, 100) === 42) {
          scrollTimeout = scrollInitialWaitTime * 200;
          console.log("MASSIVE! happen, timeout to " + scrollTimeout + " scrolled " + refreshTimes + " times, limit " + maxScrollTimes);
      } else if(_.random(1,6) === 4) {
          scrollTimeout = scrollInitialWaitTime * _.random(4, 20);
          console.log("Random happen, timeout to " + scrollTimeout + " scrolled " + refreshTimes + " times, limit " + maxScrollTimes);
      }

      if(refreshTimes >=  maxScrollTimes ) {
          appendLog({ 'why': 'auto_refresh', 'from': location, 'when' : moment(), 'auto_scroll': refreshTimes });
          location.reload(); // implicit, reinit the variables here
          scrollTimeout = scrollInitialWaitTime;
          whereScroll = height;
      } else {
          refreshTimes += 1;
          console.log("scroll to " + whereScroll + " next scroll at: " + scrollTimeout);
          scrollTo(0, whereScroll);
          setTimeout(scrollDown, scrollTimeout);
      }
};

(function() {
    'use strict';
    waitForKeyElements ("div .userContentWrapper", newUserContent);
    setTimeout (checkToFlush, FLUSH_INTERVAL);
    setTimeout (scrollDown, scrollInitialWaitTime);
})();
