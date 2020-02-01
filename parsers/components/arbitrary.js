var _ = require('lodash');
var debug = require('debug')('parsers:components:arbitrary');

function arbitrary(envelop) {
    /* an arbitrary reason is like ff64c27fa828afef7cd94e55d47ef7b94c9e2854
     * and the difference with 'reason' is: do not depends on 'h5' and 'h6' */

    const likePage = envelop.jsdom.querySelectorAll('button.pageLikeButton');

    if(likePage.length === 1) {
        /* violence to public safety ahead */

        let i = envelop.impression.html.indexOf( likePage[0].outerHTML );
        if(i > 1000)
            return null;

        /* 1) take the html code max to 1000, before the first "like" which might 
         *    or might not be there, I've to check 
         * 2) remove all the chars which are not in the string, but in HTML
         * 3) take the longer string left
         *
         * THIS IS SAVAGE */
        let firstChunk = envelop.impression.html.substring(0, i);

        let tampered = _.reduce([/</g, /=/g, />/g, /_/g, /;/g, /:/g, /"/g], function(memo, s) {
            return _.replace(memo, s, '|');
        }, firstChunk);

        let chunks = _.split(tampered, '|');
        let selected = _.first(_.reverse(_.orderBy(chunks, _.size)));

        if(_.size(selected) > 30) {
            debug("Found an arbitrary reason: '%s'", selected);
            return selected;
        }
    }
    return null;
};

module.exports = arbitrary;

