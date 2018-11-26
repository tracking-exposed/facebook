#!/usr/bin/env node
var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('parser:range');
var errorrevi = require('debug')('related:view');
var errorcore = require('debug')('metadata:core');
var errorlike = require('debug')('metadata:likes');
var errorview = require('debug')('metadata:view');
var errorrele = require('debug')('metadata:related');

var walk = require('../lib/walk');
var parse = require('../lib/parse');

const range = walk.composeRange(
    nconf.get('since') || moment().subtract(1, 'month').format(),
    nconf.get('until') || moment().format('YYYY-MM-DD 23:59:59'),
    nconf.get('range') || 24
);

function parse(timerange) {

    debug("timerange: %j", timerange);


};

return Promise
    .map(range, parse, { concurrency: 1 })
    .then(function(results) {
        var total = _.reduce(results, function(memo, iterationamount) {
            return memo += iterationamount;
        }, 0);
        debug("%d iteration, processed %d impressions", _.size(results), iterationamount);
    });
