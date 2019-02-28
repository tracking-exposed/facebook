const _ = require('lodash');
const expect    = require("chai").expect;
const nconf = require("nconf");
const Promise = require("bluebird");
const moment = require("moment");
const debug = require("debug")("test:1InitializePhase");

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

  it("clean existing supporters", function() {
    return mongo
      .remove(nconf.get('schema').supporters, { userId: fixtures.mockUserId })
      .then(function() {
        return mongo
          .read(nconf.get('schema').supporters, { userId: fixtures.mockUserId })
          .then(_.first)
          .tap(function(supporter) {
            expect(supporter).to.be.equal(undefined);
          });
      });
  });

  it("create a dummy supporter", function() {
    return adopters.create({
      supporterId: fixtures.mockUserId,
      publickey: fixtures.mockPublicKey,
      version: fixtures.mockVersion,
    })
    .then(function(supporter) { 
      expect(supporter.pseudo).to.be.equal(fixtures.mockExpectedPseudo);
    });
  });


  it("convert HTMLs, impressions and timelines for mockUserId", function() {
    function convertor(cName) {
      const mongoC = _.get(nconf.get('schema'), cName);

      return mongo
        .read(mongoC, {})    
        .map(function(e) {
          e.userId = fixtures.mockUserId;
          return mongo.updateOne(mongoC, { id: e.id}, e);
        }, { concurrency: 1 });
    };

    return Promise.all([
      convertor('htmls'),
      convertor('impressions'),
      convertor('timelines')
    ])
    .tap(function() {
      return mongo
        .read(nconf.get('schema').htmls, { userId: fixtures.mockUserId })
        .then(function(amount) {
          expect(_.size(amount)).to.be.above(1);
        });
    });
  });

  it("Check mockUpToken work as access token", function() {
    return mongo
      .read(nconf.get('schema').supporters, { userId: fixtures.mockUserId })
      .then(_.first)
      .then(function(supporter) {
        debug(JSON.stringify(supporter));
        expect(_.size(supporter.userSecret)).to.be.equal(40);
        return supporter.userSecret;
      })
      .then(adopters.validateToken)
      .then(function(loaded) {
        debug(JSON.stringify(loaded));
        expect(loaded.pseudo).is.equal(fixtures.mockExpectedPseudo);
      });
  });

});

