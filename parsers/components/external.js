var _ = require('lodash');
var debug = require('debug')('parsers:components:external');
var helper = require('./utils/helper');


function deserveToBeSaved(lstruct, aelem) {
    /* fblinktype, link, isValid: from helper.js */
    if(!lstruct.isValid) {
        return false;
    }
    return _.size(aelem.textContent)
}

function formatLink(lstruct, aelem) {
    return _.extend(lstruct, {
        linked: aelem.textContent
    });
}


function external(envelop) {

    /* the comment area has '<form rel="async" class="commentable_item"… */
    const commentableForm = envelop.jsdom.querySelectorAll('.commentable_item');
    if(_.size(commentableForm) > 1)
        debugger;
    let commentOffset = 0;
    if(_.size(commentableForm)) {
        const commentOffset = envelop.impression.html.indexOf(commentableForm[0].outerHTML);
    };

    /* simply, look for external links and collect them,
     * comment links are separated */
    const alla = envelop.jsdom.querySelectorAll('a[href^="https://l.facebook"]');

    const externals = _.reduce(alla, function(memo, a) {
        var thisOffset = envelop.impression.html.indexOf(a.outerHTML);
        if(thisOffset < commentOffset)
            return memo;

        var l = helper.facebookLink(a.getAttribute('href'));

        if(!l.isValid)
            helper.indicator(envelop, 'obscureLink', null);

        if(!deserveToBeSaved(l, a))
            return memo;

        memo.push(formatLink(l, a));
        return memo;
    }, []);

    // just for research
    const comments = _.reduce(alla, function(memo, a) {
        var thisOffset = envelop.impression.html.indexOf(a.outerHTML);
        if(thisOffset > commentOffset)
            return memo;

        var l = helper.facebookLink(a.getAttribute('href'));
        if(!deserveToBeSaved(l, a))
            return memo;

        memo.push(formatLink(l, a));
        return memo;
    }, []);

    if(_.size(comments)) {
        debug("comments links seems never worked, so, why it is now? ignored!");
        debugger;
    }

    return externals;
};

module.exports = external;
