var _ = require('lodash');
var debug = require('debug')('parsers:components:nature');

function findOutNature(envelop) {

    /* nature would be 'organic', 'sponsored', 'viral', null */
    let retval = null;

    if(envelop.indicators) {
        debug("Based on these indicators, this is sponsored: %j", envelop.indicators);
        retval = 'sponsored';
    } else if(envelop.postId) {
        retval = 'organic';
    } else {
        envelop.errors.push({
            step: 'integrity',
            error: 'lack of postId with organic nature'
        });
    } // TODO 'viral', prima come 'notes' e poi definitivo

    debug("%s", retval);
    return retval;
};

module.exports = findOutNature;
