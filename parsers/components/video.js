var _ = require('lodash');
var debug = require('debug')('parsers:components:video');

function video(envelop) {

    let v = envelop.jsdom.querySelectorAll('video');

    const ret = _.map(v, function(e) {
        return {
            muted: e.getAttribute('muted'),
            preload: e.getAttribute('preload'),
        };
    });

    if(_.size(ret) > 0) {
        debug("%s", JSON.stringify(ret));
        return ret;
    }
};

module.exports = video;
