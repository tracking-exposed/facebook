var _ = require('lodash');
var debug = require('debug')('parsers:components:event');

function event(envelop) {

    /* it return if a special event which has not been spot as link, is actually the permaLink
     * a7f651c0b23396dd91cc06d478eb25908b1b9b23 */

    let exist = _.filter(envelop.jsdom.querySelectorAll('[href^="/events/"]'), function(n) {
        return n.hasAttribute('data-hovercard')
    });

    if(!_.size(exist))
        return null;
    if(_.size(exist) > 1)
        debug("Whoa, very atypical! %j", _.map(exist, '.outerHTML'));

    exist = _.first(exist);

    debug("Found event: %s", exist.getAttribute('href').replace(/\?.*/, ''));
    return {
        permaLink: exist.getAttribute('href').replace(/\?.*/, ''),
        fblinktype: 'events'
    };
};

module.exports = event;
