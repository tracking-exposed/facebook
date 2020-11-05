const _ = require('lodash');
const debug = require('debug')('parsers:hrefChains');
const querystring = require('querystring');

function hrefChains(envelop) {
    const hrefs = _.map(envelop.jsdom.querySelectorAll('a'), function(anode) {
        const href = anode.getAttribute('href');
        const retval = {};
        retval.href = href;
        retval.text = anode.textContent;
        try {
            const Uo = new URL(href);
            retval.URL = Uo;
        } catch(e) {}
        return retval;
    });

    debugger;
    return {
        hrefs
    };
}

module.exports = hrefChains;

/*
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

    sharedContent.push({
        type: 'originalAuthor',
        content: authorName,
        fblink: authorLink
    });
    debug("Shared post, [original author] found! %s <%s>", sharer[0].content, sharer[0].fblink);

    if(_.size(a) === 2) {
        sharedContent.push({
            type: 'originalContent',
            content: a[1].textContent,
        });
    } else {
        debugger;
    }

    return {
        'sharer': sharer,
        'sharedContent': sharedContent
    };
};

*/