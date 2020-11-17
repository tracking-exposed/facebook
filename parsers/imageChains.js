const _ = require('lodash');
const debug = require('debug')('parsers:images');
const helper = require('./helper');

function mineImg(anode) {
    let retval = {
        src: anode.getAttribute('src'),
        role: anode.getAttribute('role'),
        parent: anode.parentNode.tagName,
        parentRole: anode.parentNode.getAttribute('role'),
        parentLabel: anode.parentNode.getAttribute('aria-label'),
        height: anode.getAttribute('height'),
        width: anode.getAttribute('width'),
    };

    if(retval.height && retval.width)
        retval.dimension = [ _.parseInt(retval.width), _.parseInt(retval.height) ];

    retval = helper.updateHrefUnit(retval, 'src');
    return retval;
}

function imageChains(envelop) {
    /* alt, the altenative text used in pictures, might contain the individual name of an user
     * from their picture profile. This selector might take that too. That is not an information
     * we should collect */
    const images = _.map(envelop.jsdom.querySelectorAll('img'), mineImg);
    return { images };
};

module.exports = imageChains;