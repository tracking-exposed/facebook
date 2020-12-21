var _ = require('lodash');
const helper = require('./helper');
var debug = require('debug')('parsers:nature');

function nature(envelop, previous) {

    let retval = {
        kind: envelop.impression.kind,
        from: envelop.impression.from,
        visibility: envelop.impression.visibility,
    }
    return retval;
};

module.exports = nature;
