var _ = require('lodash');
var debug = require('debug')('parsers:components:commentable');

function commentable(envelop) {
    const alltheH6 = envelop.jsdom.querySelectorAll('h6');
    var retval = null;

    if(_.size(alltheH6)) {
        const consideredH6 = _.last(alltheH6);
        const inpnum = consideredH6.parentNode.querySelectorAll('input').length;
        /* Comments have 2 <input> field, one for the text,
         * the second for the file upload */

        if(inpnum === 2) 
            retval = true;
        else if(inpnum === 0)
            retval = false;
        else {
            debug("strange condition?");
            retval = false;
        }
    }
    else
        retval = false;

    const commentableForm = envelop.jsdom.querySelectorAll('.commentable_item');
    if(_.size(commentableForm) > 1 && retval === false) {
        debug("odd condition, but it should be investigated");
        debugger;
    }

    return retval;
};

module.exports = commentable;
