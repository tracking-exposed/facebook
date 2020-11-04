const _ = require('lodash');
const debug = require('debug')('parsers:components:semantic');

function fullText(envelop) {
    var t = [];
    _.each(envelop.usertext, function(e) {
        if(e.type == 'text')
            t.push(e.text);
    });
    _.each(envelop['data-ad-preview'], function(e) {
        if(['message','headline','link-description'].indexOf(e.info) !== -1)
            if(_.size(e.text) > 0)
                t.push(e.text);
    });
    if(envelop.opengraph && _.size(envelop.opengraph.title))
        t.push(envelop.opengraph.title);
    if(envelop.opengraph && _.size(envelop.opengraph.description))
        t.push(envelop.opengraph.description);

    if(_.size(t))
        debug("%s", JSON.stringify(t, undefined, 2));
    return _.join(t, "\n");
};

module.exports = {
    fullText: fullText,
};
