var _ = require('lodash');
const helper = require('./helper');
var debug = require('debug')('parsers:nature');

function recurspan(node) {
    const style = node.getAttribute('style');
    const l = _.size(style);
    const x = { sizeh: _.size(node.innerHTML), sizest: l, style, text: node.textContent };
    x.children = _.map(node.children, recurspan);
    return x;
}

function nature(envelop, previous) {

    let retval = {
        kind: envelop.impression.kind,
        from: envelop.impression.from,
        visibility: envelop.impression.visibility,
    }
    return retval;
    /*
    const hrefs = _.get(previous, 'hrefChains.hrefs');
    return _.extend(retval, {
        hrefs: _.drop(hrefs, _.size(hrefs) - 10),
        hamount: _.size(hrefs),
        from: previous.attributions ? previous.attributions.publisherName : "NONE!",
        recu: _.map(envelop.jsdom.querySelectorAll('[href="#"] > span'), recurspan),
        info: envelop.jsdom.querySelectorAll('[aria-label="Sponsored"]').length,
    }) */
};

module.exports = nature;
