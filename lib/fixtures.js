const _ = require('lodash');
const mongo = require('./mongo');
const utils = require('./utils');
const Promise = require('bluebird');
const various = require('./various');
const nconf = require('nconf');

function checkFixtures() {
    return mongo.doesMongoWorks();
};

module.exports = {
    checkFixtures: checkFixtures,
    
    /* some spare data used in the tests */
    mockUserId: 1,
    mockPublicKey: "nothing special to see here",
    mockVersion: "0.0.T",
    mockExpectedPseudo: "beans-peas-couscous"
};
