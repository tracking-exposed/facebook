var _ = require('lodash');
var debug = require('debug')('parsers:components:regexp');
var helper = require('./utils/helper');
var moment = require('moment');

function regexp(envelop) {

    const ChristC = new RegExp("[Cc]hrist\ ?[cC]hurch", 'g');
    const cC = envelop.impression.html.match(ChristC);

    const Utrecht = new RegExp("Utrecht", 'ig');
    const uC = envelop.impression.html.match(Utrecht);

    return regexp = {
        christchurch: _.size(cC),
        utrecht: _.size(uC),
    };
};

module.exports = regexp;
