var _ = require('lodash');
var debug = require('debug')('parsers:components:shared');
var helper = require('./utils/helper');

function lazyH(envelop) {
    const h5 = envelop.jsdom.querySelectorAll('h5');
    const h6 = envelop.jsdom.querySelectorAll('h6');
    /* by default return h5, because comments are always in h6,
     * EXTRA we can check
     > envelop.jsdom.querySelectorAll('h6')[0].outerHTML
     '<h6 class="accessible_elem">Comments</h6>'
     this class                                                 * */
    return h5.length ? h5 : h6;
}

function shared(envelop) {
    /* when x shared port y, it is in 'h6' and the shared post has
     * the original poster's name (on top of the shared original).
     * id 0370eef171dac50362fdbdabfd9f4333f0f0d14d               */
    const h = lazyH(envelop);
    /* sometime is h6, sometime h5, wtf ?
     * b8b975870a2dfb6c89f23ea52aa837f6833220b8 */

    /* the comment area has '<form rel="async" class="commentable_item"… */
    const commentableForm = envelop.jsdom.querySelectorAll('.commentable_item');
    if(_.size(commentableForm) > 1)
        debugger;
    let commentOffset = 0;
    if(_.size(commentableForm)) {
        const commentOffset = envelop.impression.html.indexOf(commentableForm[0].outerHTML);
    };

    const abbr = envelop.jsdom.querySelectorAll('abbr');
    // debug("Checking the #<abbr>: %d (commentable form) %d", _.size(abbr), _.size(commentableForm) );

    const sharedAbbr = _.filter(_.tail(abbr), function(elem) {
        var thisOffset = envelop.impression.html.indexOf(elem.outerHTML);
        var isAfter = thisOffset > commentOffset;
        return !isAfter;
    });

    if(!_.size(sharedAbbr)) {
        debug("- This post do not seems a shared post (but this module seems broken)");
        return null;
    }

    debug("Found a shared post!");
    let sharer = [];
    debugger;
    throw new Error("extractDate and extractPermLink changed");
    let sharedContent = [
        // helper.extractDateLink(sharedAbbr[0])
    ];

    if(!h[0])
        debugger;
    var a =  h[0].querySelectorAll('a');

    sharer.push({ 
        type: 'sharedBy',
        content: a[0].textContent,
        fblink: a[0].getAttribute('href').replace(/\?.*/, '')
    });
    debug("sharer: %j, and now, trying fully logic...", sharer);

    /* if two links are in h6, we are in the condition:
     * _pippo_ shared a _post_
     * and _pippo_ plus the picture profile, have an /ajax/hovercard/,
     *
     * the link below, the one with the name of the original author is not on an h5/h6
     * but rather on a <span><a>, we use the hovercard to catch is.
     *
     * but because the hovercards in span are too many, I'm doing something /truce/
     */
    const sharedTimeOffset = envelop.impression.html.indexOf(sharedAbbr[0].outerHTML);
    var originalE = null;

    _.times(20, function(i) {
        var start = (sharedTimeOffset) - (i * 200);
        
        var m = envelop.impression.html
            .substring(start, sharedTimeOffset)
            .match(/data-hovercard-referer="(.*)"\ /)
        
        if(m) {
            var refkey = m[1].substr(0, 30); // enough to take a chunk of the data-hovercard-refered
            var selector = `[data-hovercard-referer^="${refkey}"]`;
            originalE = _.first(envelop.jsdom.querySelectorAll(selector));
        }
    });

    if(!originalE) {
        // check <abbr> and look till 4000 bytes behind if the data-hovercard-referer exists
        debugger;
    }

    var authorName = originalE.textContent;
    var authorLink = originalE.getAttribute('href').replace(/\?.*/, '');

    sharedContent.push({
        type: 'originalAuthor',
        content: authorName,
        fblink: authorLink
    });
    debug("Shared post, [original author] found! %s <%s>", sharer[0].content, sharer[0].fblink);

    if(_.size(a) === 2) {
        /* below the data from the header, which causes the 
         * post appear in the timeline */
        sharedContent.push({
            type: 'originalContent',
            content: a[1].textContent,
            fblink: a[1].getAttribute('href').replace(/\?.*/, '')
        });
    } else {
        debugger;
    }

    return {
        'sharer': sharer,
        'sharedContent': sharedContent
    };
};

module.exports = shared;

