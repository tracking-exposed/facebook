const _ = require('lodash');
const expect    = require("chai").expect;
const nconf = require("nconf");
const Promise = require("bluebird");
const moment = require("moment");
const debug = require("debug")("test:testSummaryRoute");

const mongo = require("../lib/mongo");
const fixtures = require('../lib/fixtures');
const adopters = require('../lib/adopters');
const summary = require('../routes/summary');

nconf.argv().env().file({ file: "config/unitTest.json" });

const minimum = nconf.get('minimum') ? _.parseInt(nconf.get('minimum')) : 1;
const mandatory = ['timelines', 'impressions', 'metadata',
                   'htmls', 'summary', 'supporters' ];

let dummyAccessToken = null;

/* This first check the capacity of load data and verify they are avail */
describe(`Routes pre-check about ${nconf.get('mongodb')}`, function() {

  function testExistence(columnName) {
    it(`Counting data in ${columnName} [${minimum} as \`minimum\`]`, function() {
    return mongo
      .count( _.get(nconf.get('schema'), columnName), {})
      .then(function(amount) {
        expect(amount).to.be.above(minimum);
      });
    });
  }

  it("check the amount of object in the mandatory collections", function() {
    return Promise.map(mandatory, function(c) {
      return testExistence(c);
    }, { concurrency: 1 });
  });


  it("fetch the dummy access token", function() {
    return mongo
      .read(nconf.get('schema').supporters, { userId: fixtures.mockUserId })
      .tap(function(results) {
        expect(results).to.have.lengthOf(1);
      })
      .then(_.first)
      .tap(function(supporter) {
        expect(supporter.userSecret).to.have.lengthOf(40);
        dummyAccessToken = supporter.userSecret;
      });
  });

});

describe("Test 'page' route", function() {
    // temporarly disabled, still to be decided if should be used
});

describe("Test 'data' route", function() {

  it("Check mockUpToken work as access token", function() {
    return adopters
      .validateToken(dummyAccessToken)
      .tap(function(supporter) {
        expect(supporter.pseudo).is.equal(fixtures.mockExpectedPseudo);
      });
  });

  it("retrieve summary as JSON", function() {
    const fixedMax = 20;
    return summary
      .data({ params: { amount: fixedMax, userToken: dummyAccessToken }})
      .then(function(answer) {
        expect(answer).to.have.all.keys(['json']);
        return answer.json;
      })
      .tap(function(content) {
        expect(content).to.have.lengthOf.at.most(fixedMax);
        expect(content).to.have.lengthOf.at.least(1);
      });
  });

});

describe("Test 'csv' route", function() {
});
describe("Test 'extended' route", function() {
});
describe("Test 'semantics' route", function() {
});
