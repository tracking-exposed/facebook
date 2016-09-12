/* this file is copied from the version 0.9.8 and here is supposed to be
 * improved in the parsing, using better CSS selector instead of my
 * stupid regexp in HTML */

var extractInfoPromoted = function(nodehtml, postType) {

    var startHref = nodehtml.search(/href="https:\/\/www.facebook.com\//),
        hrefP = nodehtml.substring(startHref + 6).replace(/" .*/, '').replace(/"> .*/, '');

    return {
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
        reportError({error: "debugging", reason: "small", content: nodehtml });
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
    reportError({error: "debugging", reason: "failure", content: nodehtml });
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
    reportError({error: "debugging", reason: "child", number: childNodes, content: nodehtml });
    if(d) console.log("return promoted, spotted: " + childNodes + " childNodes");
    return('promoted');
};


var newUserContent = function(jNode) {
    var node = jNode[0];
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

    if(pathname !== "/") {
        uniqueLocation.unique = -1;
        uniqueLocation.when = undefined;
        uniqueLocation.counter = -1;
        return;
    }

    var feedEntry = {
        'when' : moment().format(),
        'refreshUnique': uniqueLocation.unique
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
        if (!_.isNull(lastAnalyzedPost) && !_.isNull(lastAnalyzedPost.content[0]) ) {
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
        reportError({error: "a node impossible to be parsed correctly", node: jNode});
        verboseEntry(jNode, lastAnayzedPost, "Previous", postType);
        appendLog(lastAnalyzedPost);
        lastAnalyzedPost = null;
    }
};


module.exports = {
  extractInfoPromoted: extractInfoPromoted,
  extractInfoFromFeed: extractInfoFromFeed,
  extractPostType: extractPostType,
  newUserContent: newUserContent
};

