var _ = require('lodash');
const helper = require('./helper');
var debug = require('debug')('parsers:nature');

function nature(envelop, previous) {

    let retval = {
        kind: envelop.impression.kind,
        from: envelop.impression.from,
        visibility: envelop.impression.visibility,
    }

    if(previous.viralcheck.success) {
      retval.kind = 'viral';
      retval.visibility = previous.viralcheck.match;
    }

    return retval;
};

module.exports = nature;
