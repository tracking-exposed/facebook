const _ = require('lodash');
const debug = require('debug')('parsers:textChains');

function recursiveTextContent(memo, node) {

    if(node.children.length) {
        return _.reduce(node.children, recursiveTextContent, memo);
    } else {
        memo.push(node.textContent);
        return memo;
    }
};

function textChains(envelop) {
    /* a reason is like 54c7c8f6c5440407cb7ee764620424ecdd6fea3f
     * when a post report on top why it is display.
     * it is an h5 with quality of "it is before every /ajax/hovercard/" */

    // "Suggested for You"
    const span = _.compact(_.reduce(envelop.jsdom.querySelectorAll('span'), recursiveTextContent, []));
    const div = _.compact(_.reduce(envelop.jsdom.querySelectorAll('div'), recursiveTextContent, []));
    const a = _.compact(_.reduce(envelop.jsdom.querySelectorAll('a'), recursiveTextContent, []));
    const h2 = _.compact(_.reduce(envelop.jsdom.querySelectorAll('h2'), recursiveTextContent, []));
    const h3 = _.compact(_.reduce(envelop.jsdom.querySelectorAll('h3'), recursiveTextContent, []));
    const h4 = _.compact(_.reduce(envelop.jsdom.querySelectorAll('h4'), recursiveTextContent, []));
    const h5 = _.compact(_.reduce(envelop.jsdom.querySelectorAll('h5'), recursiveTextContent, []));
    const h6 = _.compact(_.reduce(envelop.jsdom.querySelectorAll('h6'), recursiveTextContent, []));
    const strong = _.compact(_.reduce(envelop.jsdom.querySelectorAll('strong'), recursiveTextContent, []));
    const uniques = _.reverse(_.orderBy(_.uniq(div), 'length'));

    return {
        h2, h3, h4, h5, h6,
        span,
        strong,
        div,
        a,
        uniques,
    };

};

module.exports = textChains;
