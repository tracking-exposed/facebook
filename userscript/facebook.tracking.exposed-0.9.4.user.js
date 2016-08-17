// ==UserScript==
// @name         facebook.tracking.exposed
// @namespace    https://facebook.tracking.exposed
// @version      0.9.4
// @description  Collection meta-data from Facebook's timeline, in order to analyze and look for potential informative manipulation (if you've never heard about Filter Bubble, and you're still young⌁inside™, start here https://en.wikipedia.org/wiki/Filter_bubble )
// @author       Claudio Agosti @_vecna
// @match        https://www.facebook.com/*
// @connect      facebook.tracking.exposed
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @require      https://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.13.0/moment.min.js
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/lodash-compat/3.10.2/lodash.min.js
// ==/UserScript==

GM_addStyle(`
.escvi--main-button {
  position: fixed;
  bottom: -1px;
  left: 25px;
  display: block;
  width: 50px;
  height: 50px;
  background-color: palegreen;
  color: black;
  font-size: 2em;
  font-weight: bold;
  line-height: 50px;
  text-align: center;
  border: 1px solid #888;
  opacity: 0.6;
  transition: opacity 0.3s ease-in-out;
}

.escvi--main-button:hover {
  text-decoration: none;
  opacity: 1;
}
`);

var d = false, /* debug */
    ee = false; /* explicit in the page */
var uniqueLocation = { counter: -1, unique: -1 },
    lastLocation = null,
    toBeFlush = {'debug': [], 'timeline': [] },
    user = null,
    init = false,
    lastAnalyzedPost = null,
    STARTING_FRACTION = 300,
    url = 'https://facebook.tracking.exposed',
    FLUSH_INTERVAL = 20000;

var renderMainButton = function() {
    var mainButton = $("<a />", {
        html: '↺',
        "class": "escvi--main-button",
        href: url + "/realitycheck/" + user.id,
        target: "_blank"
    });
    $('body').append(mainButton);
};

var extractInfoPromoted = function(nodehtml, postType) {

    var startHref = nodehtml.search(/href="https:\/\/www.facebook.com\//),
        hrefP = nodehtml.substring(startHref + 6).replace(/" .*/, '').replace(/"> .*/, '');

    return {
        href_stats: [ startHref ],
        href: hrefP,
        additionalInfo: null,
        publicationTime: null,
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
            /* href_stats: [ block.search(/href="/), fraction ],
               child: _.size($(nodehtml)[0].childNodes),
               parsedUtime: utime */
            href: href,
            additionalInfo: (profileS !== -1) ? profileHref : null,
            publicationTime: moment(_.parseInt(utime) * 1000).format(),
            type: postType
        };
    }
    return null;
};

var extractPostType = function(nodehtml) {
    var childNodes = _.size($(nodehtml)[0].childNodes);
    switch(childNodes) {
        case 5:
            return('feed');
        case 3:
            return('related');
    }
    if(d) console.log("return promoted, spotted: " + childNodes + " childNodes");
    return('promoted');
};

var verboseEntry  = function(node, post, whichPost, fromWhere) {
    if (!ee) return;
    html = [ '<small>', '<pre>', fromWhere, 'Now at[', whichPost, ']#', JSON.stringify(uniqueLocation, undefined, 2),
             post, 'is', JSON.stringify(post, undefined, 2), '</pre>', '</div></small>'];
    $(node).append(html.join(" "));
};

var basicSetup = function() {

    var x = $("div > a");

    _.each(x, function(aElem, cnt) {
        var img = _.get($(aElem)[0], 'firstChild');
        if(!_.isUndefined($(img)[0])) {
            var profile_id = _.get($(img)[0], 'id');
            var pattern = 'profile_pic_header_';
            if (_.startsWith(profile_id, pattern)) {
                user = {
                    id: profile_id.substring(_.size(pattern), _.size(profile_id)),
                    href: aElem.href
                };
            }
        }
    });

    if(_.isNull(user) || _.isUndefined(_.get(user, 'id'))) {
        if(d) console.log("Impossible parse the user from " + _.size(x) + " html elements!?");
    } else {
        init = true;
        /* paintLogo */
        console.log("facebook.tracking.exposed initialization: rendering main button, detected user: " + JSON.stringify(user) );
        /* find someone able to implement properly the issue #1 */
        renderMainButton();
    }
};

var newUserContent = function(jNode) {
    var node = jNode[0],
        pathname = document.location.pathname;

    if(!init)
        basicSetup();

    if (_.get(node, 'attributes[2].nodeName') !== 'aria-label')
        return;

    /* clean pathname if has an ?something */
    pathname = pathname.replace(/\?.*/, '');

    /* this fit new location or locantion changes */
    if (pathname !== lastLocation && pathname === '/') {
        refreshIsHappen();
    }
    lastLocation = pathname;

    if(pathname != "/")
        return;

    var feedEntry = {
        'when' : moment().format(),
        'refreshId': uniqueLocation.unique
    };

    var postType = extractPostType(node.innerHTML);

    if ( postType === 'feed' ) {
        feedPost = extractInfoFromFeed(node.innerHTML, postType);
        verboseEntry(jNode, lastAnalyzedPost, "previous", "Feed", pathname);
        appendLog(lastAnalyzedPost);
        feedEntry.order = uniqueLocation.counter = (uniqueLocation.counter + 1);
        feedEntry.content = [ feedPost ];
        lastAnalyzedPost = feedEntry;
        verboseEntry(jNode, lastAnalyzedPost, "recorded Feed", "Feed", pathname);
    } else if ( postType === 'promoted' ) {
        promotedPost = extractInfoPromoted(node.innerHTML, postType);
        verboseEntry(jNode, lastAnalyzedPost, "previous", "Promoted", pathname);
        appendLog(lastAnalyzedPost);
        if(!_.isNull(promotedPost)) {
            feedEntry.order = uniqueLocation.counter = (uniqueLocation.counter + 1);
            feedEntry.content = [ promotedPost ];
            lastAnalyzedPost = feedEntry;
            verboseEntry(jNode, lastAnalyzedPost, "recorder Promoted", "Promoted");
        } else {
            verboseEntry(jNode, null, "_.isNull this!", "Promoted");
            lastAnalyzedPost = null;
        }
    } else if ( postType === 'related') {
        postInfo = extractInfoFromFeed(node.innerHTML, postType);
        if (!_.isNull(lastAnalyzedPost) && !_.isUndefined(_.get(lastAnalyzedPost, 'content')) ) {
            verboseEntry(jNode, lastAnalyzedPost, "previous", "Related");
            lastAnalyzedPost.content[0].type = 'friendlink';
            lastAnalyzedPost.content[1] = postInfo;
        } else {
            verboseEntry(jNode, null, "previous isNull?", "Related/Broken");
            feedEntry.order = uniqueLocation.counter = (uniqueLocation.counter + 1);
            feedEntry.content = [ postInfo ];
            feedEntry.content.type = 'broken';
            lastAnalyzedPost = feedEntry;
        }
        verboseEntry(jNode, lastAnalyzedPost, "committing this", "Related (friend)");
        appendLog(lastAnalyzedPost);
        lastAnalyzedPost = null;
    } else {
        if (d) console.log("Parsing of this node didn't success, counter is: " + uniqueLocation.counter);
        reportError("a node impossible to be parsed correctly");
        verboseEntry(jNode, lastAnayzedPost, "Previous", postType);
        appendLog(lastAnalyzedPost);
        lastAnalyzedPost = null;
    }
};

var appendLog = function(entryDict) {
    if(!_.isNull(entryDict)) {
        toBeFlush.timeline.push(entryDict);
    }
};

var reportError = function(errorString) {
    toBeFlush.debug.push({
        when: moment().format(),
        what: errorString
    });
};

var checkToFlush = function() {

    if( _.size(toBeFlush.timeline) || _.size(toBeFlush.debug) ) {

        var envelope = _.extend(toBeFlush, { from: user });
        if (d) console.log(envelope);
        if (d) console.log("After " + FLUSH_INTERVAL + "ms, at: " + moment() + ", " +
                           toBeFlush.timeline.length + " info to be sent, with " +
                           toBeFlush.debug.length + " errors");
        GM_xmlhttpRequest({
            method: "POST",
            url: url + '/F/2',
            headers: { "Content-Type": "application/json" },
            data: JSON.stringify(envelope),
            onload: function(response) {
                if (d) console.log("Received response of XHR: " + response.response);
            }
        });
        toBeFlush = { 'debug': [], 'timeline': [] };
    } else {
        if(d) console.log("There are no data to be send");
    }
    setTimeout (checkToFlush, FLUSH_INTERVAL);
};

var scrollTimeout = 0, // 4000,
    whereScroll = 0,
    refreshTimes = 1,
    height = window.innerHeight !== undefined ? window.innerHeight : document.documentElement.offsetHeight,
    maxScrollTimes = 80;

var scrollDown = function() {
    /* initialized with the stable recurring behavior */
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
        reportError("auto_scroll " + refreshTimes);
        location.reload();
        // implicit, reinit the variables with the .reload()
    } else {
        refreshTimes += 1;
        if (d) console.log("scroll to " + whereScroll + " next scroll at: " + scrollTimeout);
        scrollTo(0, whereScroll);
        setTimeout(scrollDown, scrollTimeout);
    }
};

var refreshIsHappen = function() {
    /* refresh is happened MAYBE -- this function can be called more then once
     * due to the different hooks used inside of the facebook page. if is called
     * in less than 1 second window, is considered a duplication */
    if(_.isUndefined(uniqueLocation.when) || moment(moment() - uniqueLocation.when).isAfter(2, 's')) {
        uniqueLocation.unique = _.random(0x10000000, 0xffffffff);
        uniqueLocation.when = moment();
        uniqueLocation.counter = 0;
        var refreshInfo = { 'what': 'refresh', 'when': uniqueLocation.when.format(), 'unique': uniqueLocation.unique };
        appendLog(refreshInfo);
        if(d) console.log(refreshInfo);
    } else {
        if(d)console.log("refresh is NOT after 2 seconds of " + uniqueLocation.when.format("mm:ss") + " compared to now " + moment().format("mm:ss") );
    }
};

(function() {
    'use strict';
    waitForKeyElements ("div .userContentWrapper", newUserContent);
    waitForKeyElements ("div .composerAudienceWrapper", refreshIsHappen);
    setTimeout (checkToFlush, FLUSH_INTERVAL);
    if(scrollTimeout)
        setTimeout (scrollDown, scrollTimeout);
})();
