var _ = require('lodash');
var debug = require('debug')('parsers:components:linkontime');
var helper = require('./utils/helper');
var moment = require('moment');

function linkontime(envelop) {
    /* this just process the first element <abbr>. In the shared.js file, this
     * element is the one stripped of by _.tail */

    const a = envelop.jsdom.querySelectorAll('a > abbr');
    const abbr = envelop.jsdom.querySelectorAll('abbr');
    let ret = {};

    if( _.size(a) > 0 && a[0].parentNode.hasAttribute('href')) {
        // 0321484797f16676609e607d9f43d7084dc6a051
        helper.notes(envelop, 'linkontime', { c: 1 });
        return _.extend(
            helper.extractPermaLink(a[0].parentNode), {
                publicationTime: helper.extractDate(a[0])
            }
        );
    }
    if( _.size(a) > 0 && a[0].hasAttribute('target') ) {
        helper.notes(envelop, 'linkontime', { c: 2 });
        debugger;
        let ret = helper.extractDateLink(a[0]);
    }
    /* else, we are in "X wants to participate in Y event" */
    else if (abbr[0] && abbr[0].hasAttribute('data-utime')) {
        // a7f651c0b23396dd91cc06d478eb25908b1b9b23
        // 8f94a1b0bcddcfe26ca8a8a7780dfb2c714f3ef2 this shoukd anyway be fill up by 'events.js'
        helper.notes(envelop, 'linkontime', { c: 3 });
        ret = {
            publicationTime: helper.extractDate(abbr[0]),
            fblinktype: null
        };
    }
    else if(abbr[0] && abbr[0].hasAttribute('title')) {
        // 0810c24b5124a325d4d2be329fe65e092e0fd2bf <- supply by event
        helper.notes(envelop, 'linkontime', { c: 4 });
        const title = abbr[0].getAttribute('title');
        const display = abbr[0].textContent;
        ret = {
            title,
            display,
            fblinktype: null,
            error: true
        };
    }
    else if(!_.size(abbr)) {
        /* old-style sponsored post, or paid parnership 'e67365bc93f6c8c9a44bdfce85bbb0d98b24bf5a' 
         * without publication time, but reachable via feed_id */
        helper.notes(envelop, 'linkontime', { c: 5 });
        helper.indicator(envelop, 'timeless');
        ret = null;
    }
    else {
        debugger;
        throw new Error(`unmanaged linkontime condition ${_.size(elements)} ${_.size(abbr)}`);
    }

    debug("returning: %s", JSON.stringify(ret));
    return ret;
};

module.exports = linkontime;
