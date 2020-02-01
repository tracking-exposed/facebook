const _ = require('lodash');
const debug = require('debug')('parsers:components:attribution');
const helper = require('./utils/helper');

function pickRightHeader(envelop, min, max) {

    const h5 = envelop.jsdom.querySelectorAll('h5');
    const selectedH5 = _.reduce(h5, function(memo, elem, index) {
        var elemOffset = envelop.impression.html.indexOf(elem.outerHTML);
        if ( elemOffset > min && elemOffset < max ) {
            if(!_.isNull(memo))
                debug("Warning, two `h5` between the acceptable window!?"); // keeping the first
            else
                memo = index;
        }
        return memo;
    }, null);

    const h6 = envelop.jsdom.querySelectorAll('h6');
    const selectedH6 = _.reduce(h6, function(memo, elem, index) {
        var elemOffset = envelop.impression.html.indexOf(elem.outerHTML);
        if ( elemOffset > min && elemOffset < max ) {
            if(!_.isNull(memo))
                debug("Warning, two `h6` between the acceptable window!?"); // keeping the first
            else
                memo = index;
        }
        return memo;
    }, null);

    if(!_.isNull(selectedH6) && !_.isNull(selectedH5)) {
        debug("Warning: both `h5` and `h6` were in the acceptable window!?");
        return null;
    }

    if( _.isNull(selectedH6) && _.isNull(selectedH5) ) {
        debug("Warning: no `h5` and no `h6` present in the acceptable window");
        return null;
    }

    /*
    debug("selectedH6 isNull?%s %d (of %d), selectedH5 isNull?%s %d (of %d)",
        _.isNull(selectedH6), selectedH6, _.size(h6),
        _.isNull(selectedH5), selectedH5, _.size(h5)
    );
     */
    return _.isNull(selectedH6) ? _.nth(h5, selectedH5) : _.nth(h6, selectedH6);
};

function getOffset(envelop, selector, min) {
    const elem = envelop.jsdom.querySelectorAll(selector);
    if(!_.size(elem))
        return -1;
    let ret = envelop.impression.html.indexOf(elem[0].outerHTML);
    if(_.size(elem) > 1) {
        if(ret < min)
            ret = envelop.impression.html.indexOf(elem[1].outerHTML);
        return ret;
    } else {
        return -1;
    }
}

function attributions(envelop) {

    if(envelop.shared || envelop.sharedContent) {
        debug("Because the content is shared, the attribution should be already made");
        return null;
    }

    /* looking at 'h5' or 'h6' it is not enough if we do not make sure to 
     * remove the 'reasons': (h5) 54c7c8f6c5440407cb7ee764620424ecdd6fea3f,
     * (h6) 1006f1bb81805c053b80379646d129add31efd60 is a shared but without
     * additional messages -- this last case, is a 'repost' from the same author
     * in a new group.                                                        * */

    /* look for the first profile picture appearing */
    const firstImgProfile = getOffset(envelop, 'img[aria-label]', 0);

    /* and this is the beginning of the content */
    const firstContent = getOffset(envelop, '.userContent', firstImgProfile);

    let h = null;
    if(firstContent !== -1 || firstImgProfile !== -1) { 
        h = pickRightHeader(envelop, firstImgProfile, firstContent);
    }

    if(_.isNull(h)) {
        debug("unfair fallback to look for h5! (.userContent %d)(img[aria-label] %d)",
            firstContent, firstImgProfile);
        h = _.first(envelop.jsdom.querySelectorAll('h5'));
        /* because the reason is present, we are going to ignore the first `h5` element */
        if(envelop.reasons)
            h = _.first(_.tail(h));
    }

    let retval = [];
    /* we pick the offset between the first picture (profile image) and the userContent */

    if(_.isUndefined(h)) {
        debug("Absurd fallback, but, hey, we are playing with facebook :P");
        /* 1fe9b6c4a228f0c85ef7e5e18111e3bca8d54b72 */
        x = envelop.jsdom.querySelectorAll('a[data-hovercard^="/ajax/hovercard"]');
        if(_.size(x) != 1)
            debug("one of the many strange condition again");

        retval.push({
            type: 'authorName',
            display: x[0].textContent,
            content: x[0].textContent,
            fblink: helper.stripURLqs(x[0].getAttribute('href'))
        });
    } /* else, is an 'h' */ else {
        retval.push({
            type: 'authorName',
            display: h.textContent,
            content: h.firstChild.querySelector('a').textContent,
            fblink: helper.stripURLqs(h.firstChild.querySelector('a').getAttribute('href'))
        });
    }
    debug("attribution made: %s (%s)", retval[0].content, retval[0].fblink);

    /*
    if(h.firstChild.querySelector('a').parentNode.nextSibling &&
       h.firstChild.querySelector('a').parentNode.nextSibling.texContent) {

        // action is the act of "XXX shared a post on YYY" or "XXX published a photo"
        // it is still too confusing the h5/h6 logic here, that's why is commented 
        debugger;
        retval.push({
            type: 'action',
            content: h.firstChild.querySelector('a').parentNode.nextSibling.textContent.replace(/^\ /, '')
        });
        debug("an `action` detected: %s", _.last(retval).content);
    }
    */

    return retval;
    // metti percentuale di dove gli offset si trovano, metti se ha fallito il pickRightHeader
};

module.exports = attributions;
