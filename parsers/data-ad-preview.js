var _ = require('lodash');
var debug = require('debug')('parsers:components:data-ad-preview');
var helper = require('./helper');

function dataOnPreview(envelop) {

    const adMarker = envelop.jsdom.querySelectorAll('[data-ad-preview]');
    /* for each of these elements save the display text, and investigated on links/src */

    const infos = _.map(adMarker, function(node) {

        let info = node.getAttribute('data-ad-preview');
        let text = node.textContent;
        var retval = { info, text };

        /* src */
        if(node.hasAttribute('src')) {
            let imagesrc = node.getAttribute('src');
            retval.src = imagesrc;

            if(helper.isFacebook(imagesrc))
                _.extend(retval, helper.facebookLink(imagesrc));
            else if(helper.isFacebookCDN(imagesrc))
                retval.extacted = helper.decodeAndExtractURL(imagesrc);
            else
                debugger; // retval.cleaned = parseHelper.decodeAndExtractURL(imagesrc);
        }

        /* href */
        if(node.hasAttribute('href')) {
            let linkhref = node.getAttribute('href');
            retval.href = linkhref;

            if(helper.isFacebook(linkhref))
                _.extend(retval, helper.facebookLink(linkhref));
            else
                retval.cleaned = helper.decodeAndExtractURL(linkhref);
        }

        return retval;
    });

    let stats = _.countBy(infos, 'info');
    const CAROUSEL = 'carousel-cta';
    if(_.get(stats, CAROUSEL))
        helper.indicator(envelop, CAROUSEL, _.get(stats, CAROUSEL));

    if(_.size(_.size(infos)))
        debug("%j", _.countBy(infos, 'info'));

    return infos;
};

module.exports = dataOnPreview;
