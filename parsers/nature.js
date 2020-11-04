var _ = require('lodash');
var debug = require('debug')('parsers:components:nature');

function findOutNature(envelop) {

    /* nature can be 'organic', 'sponsored', 'viral', null */
    let retval = null;

    if(envelop.indicators) {
        debug("Based on these indicators [%j] this is sponsored", envelop.indicators);
        retval = 'sponsored';
    } else if(envelop.postId) {
        retval = 'organic';
    } else {
        envelop.errors.push({
            step: 'integrity',
            error: 'lack of postId with organic nature'
        });
        debug("integrity failure!");
    } // TODO 'viral', prima come 'notes' e poi definitivo

    return retval;
};

module.exports = findOutNature;
