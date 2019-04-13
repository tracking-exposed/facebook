#!/usr/bin/env node
const moment = require('moment');
const _ = require('lodash');

_.times(52, function(wn) {  x = moment({year: 2018}).add(wn, 'w').unix();  console.log(x); });

/* this input is feed to a mongoscript */
