const _ = require('lodash');
const expect    = require("chai").expect;
const nconf = require("nconf");
const Promise = require("bluebird");
const moment = require("moment");
const debug = require("debug")("test:testSummaryRoute");

const mongo = require("../lib/mongo");
const fixtures = require('../lib/fixtures');
const adopters = require('../lib/adopters');

nconf.argv().env().file({ file: "config/unitTest.json" });

const minimum = nconf.get('minimum') ? _.parseInt(nconf.get('minimum')) : 15;
const mandatory = ['timelines', 'impressions', 'metadata',
                   'htmls', 'summary', 'supporters' ];

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

  if("check the amount of data in the mandatory collections", function() {
    return Promise.map(mandatory, function(c) {
      return testExistence(c);
    }, { concurrency: 1 });
  });

});

describe("Test 'page' route", function() {
    // temporarly disabled, still to be decided if should be used
});

describe("Test 'data' route", function() {

  it("Check mockUpToken work as access token", function() {
    return adopters
      .validateToken(fixtures.mockUserToken)
      .then(function(supporter) {
        expect(supporter.pseudo).is.equal(fixtures.mockExpectedPseudo);
        expect(supporter.userToken).is.equal(fixtures.mockUserToken);
      });
  });


});


describe("Test 'csv' route", function() {
});
describe("Test 'extended' route", function() {
});
describe("Test 'semantics' route", function() {
});


