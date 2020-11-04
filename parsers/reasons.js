const _ = require('lodash');
const debug = require('debug')('parsers:components:reasons');
const helper = require('./helper');

function reasons(envelop) {
    /* a reason is like 54c7c8f6c5440407cb7ee764620424ecdd6fea3f
     * when a post report on top why it is display.
     * it is an h5 with quality of "it is before every /ajax/hovercard/" */

    /* 1st, find the h5, a "reason" is always h5 */
    const h5 = envelop.jsdom.querySelectorAll('h5')

    if(!_.size(h5))
        return null;

    /* look if we are in an anomalous condition, in theory, the .outerHTML is unique */
    if(envelop.impression.html.split(h5[0].outerHTML).length !== 2)
        debugger;

    /* record in the HTML string where is located the first occurrence */
    const firstH5offset = envelop.impression.html.indexOf(h5[0].outerHTML);

    /* look for the first profile picture appearing */
    const firstImgProfile = envelop.jsdom.querySelectorAll('img[aria-label]');

    debug("Found %d images with an [aria-label] %j",
        _.size(firstImgProfile),
        _.map(firstImgProfile, function(e) {
            return e.getAttribute('aria-label');
        })
    );
    /* and use the first image (profile) as offset */
    const firstProfileOffset = envelop.impression.html.indexOf(firstImgProfile[0].outerHTML);

    let reason = null;
    if(firstH5offset < firstProfileOffset) {
        const a = h5[0].querySelectorAll('a')[0];
        const name = a.textContent;
        const fblink = helper.stripURLqs(a.getAttribute('href'));
        reason = {
            message: h5[0].textContent,
            name,
            fblink
        };
        debug("Reason found (%s)", h5[0].textContent);
    } else {
        debug("Reason apparently not existing because %d is not < than %d",
            firstH5offset, firstProfileOffset);
    }

    return reason;
};

module.exports = reasons;

