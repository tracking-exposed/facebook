const _ = require('lodash');
const expect    = require("chai").expect;
const nconf = require("nconf");
const Promise = require("bluebird");
const moment = require("moment");
const debug = require("debug")("test:testInputPhase");

const rss = require("../lib/rss");
const mongo = require("../lib/mongo");
const fixtures = require('../lib/fixtures');
const adopters = require('../lib/adopters');

nconf.argv().env().file({ file: "config/unitTest.json" });

const minimum = nconf.get('minimum') ? _.parseInt(nconf.get('minimum')) : 15;
const mandatory = ['timelines', 'impressions', 'metadata', 'htmls'];

/* This first check the capacity of load data and verify they are avail */
describe(`Checking data in ${nconf.get('mongodb')}`, function() {

  function testExistence(columnName) {
    it(`Counting data in ${columnName} [${minimum} as \`minimum\`]`, function() {
      return mongo
        .count( _.get(nconf.get('schema'), columnName), {})
        .then(function(amount) {
          expect(amount).to.be.above(minimum);
        });
    });
  }

  it("check the presence of the five minimum collections", function() {
    return fixtures
      .checkFixtures()
      .tap(function(columns) {
         expect(columns).to.equal(mandatory);
      });
  });
    
  if("check the amount of data in the mandatory collections", function() {
    return Promise.map(mandatory, function(c) {
      return testExistence(c);
    }, { concurrency: 1 });
  });

});


describe("Basic check and setup", function() {

  it("assure data are fresh enough (if not 'npm run test:reset')", function() {
    return mongo
      .read(nconf.get('schema').htmls, {})
      .then(function(elements) {
        return _.first(elements).savingTime;
      })
     .tap(function(savingTime) {
        const d = moment.duration(moment() - moment(savingTime));
        expect(d.asSeconds()).to.be.below(30 * 24 * 3600);
     });
  });

  it("create a dummy supporter", function() {
    return mongo
      .remove(nconf.get('schema').supporters, { userId: fixtures.mockUserId })
      .then(function() { 
        return adopters.create({
          supporterId: fixtures.mockUserId,
          publickey: fixtures.mockPublicKey,
          version: fixtures.mockVersion,
        });
      })
      .then(function(supporter) {
        expect(supporter.pseudo).to.be.equal(fixtures.mockExpectedPseudo);
        fixtures.mockUserToken = supporter.userToken;
      });
  });

  it("Check mockUpToken work as access token", function() {
    return adopters
      .validateToken(fixtures.mockUserToken)
      .then(function(supporter) {
        expect(supporter.pseudo).is.equal(fixtures.mockExpectedPseudo);
        expect(supporter.userToken).is.equal(fixtures.mockUserToken);
      });
  });

});

describe("Summary generation", function() {
});
