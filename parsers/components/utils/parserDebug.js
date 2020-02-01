const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('parsers:components:parserDebug');
const utils = require('../../../lib/utils');

function parserDebug(envelop) {
    return { empty: 'nao' };
};

module.exports = parserDebug;
