const _ = require('lodash');
const debug = require('debug')('parsers:hrefChains');
const helper = require('./helper');

function hrefChains(envelop) {
    const hrefs = _.map(envelop.jsdom.querySelectorAll('a'), function(anode) {
        let retval = {
            href: anode.getAttribute('href'),
            text: anode.textContent,
        };
        retval = helper.updateHrefUnit(retval, 'href');
        return retval;
    });

    return {
        hrefs
    };
}

module.exports = hrefChains;