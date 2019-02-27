const _ = require('lodash');
const mongo = require('./mongo');
const utils = require('./utils');
const Promise = require('bluebird');
const various = require('./various');
const nconf = require('nconf');

function loadFixtures() {
	nconf.set('mongodb', 'mongodb://localhost/fbtestsource');
}

module.exports = {
  loadFixtures: loadFixtures,

	timelinesN: 18,
	impressionsN: 1645,
	htmlsN: 1151,
	metadataN: 1151
};
