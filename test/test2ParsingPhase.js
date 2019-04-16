const _ = require('lodash');
const expect    = require("chai").expect;
const nconf = require("nconf");
const Promise = require("bluebird");
const moment = require("moment");
const debug = require("debug")("test:2ParsingPhase");

const mongo = require("../lib/mongo");
const parse = require('../lib/parse');
const fixtures = require('../lib/fixtures');
const sequence = require('../parsers/components/utils/sequence');

nconf.argv().env().file({ file: "config/unitTest.json" });

describe("Parsing the HTMLs", function() {

  let merged = [];
  let initialized = [];
  let analyzed = [];
  let summary = [];

  it("Check the HTML+impression merge", function() {
    return mongo
      .read(nconf.get('schema').htmls, { userId: fixtures.mockUserId })
      .map(parse.mergeHTMLImpression)
      .then(_.compact)
      .then(function(results) {
        expect(_.size(results)).to.be.above(1);
        const keytbt = _.keys(_.first(results));
        expect(keytbt).to.include('impressionOrder');
        expect(keytbt).to.include('html');
        merged = results;
      });
  });

  it("Do the initalization [repeat=true]", function() {
    return Promise.map(merged, function(e) {
      return parse.initialize(e, true);
    })
    .then(_.compact)
    .then(function(results) {
      initialized = results;
      expect(_.size(initialized)).to.be.equal(_.size(merged));
      expect(_.keys(_.first(initialized))).to.have.members(
        ['impression', 'xmlerr', 'xpath', 'jsdom', 'dom' ]
      );
    });
  });

  it("Do the parsing", function() {
    analyzed = _.map(initialized, function(e) {
      return parse.cleanFormat(sequence(e));
    });
    expect(_.size(analyzed)).to.be.equal(_.size(initialized));
    expect(_.keys(_.first(analyzed))).to.include.members(
      ['summary', 'impressionOrder' ]);
  });

  it("Do the global/personal counting", function() {
    return Promise
      .map(analyzed, parse.postIdCount)
      .map(parse.semanticIdCount)
      .tap(function(results) {
        expect(_.size(results)).to.be.equal(_.size(analyzed));
        let semanticCheck = _.find(results, 'semanticId');
        if(semanticCheck)
          expect(_.keys(semanticCheck)).to.include.members(['semanticCount']);
        else
          console.log("\t!dummy data lack of a semantic post!");
      })
      .tap(function(results) {
        expect(_.keys(_.first(results))).to.include.members(
          ['postCount']);
        summary = results;
      });
  });

  it("Clean existing summary", function() {
    return mongo.remove(nconf.get('schema').summary, {
      user: fixtures.mockExpectedPseudo })
      .then(function() {
        return mongo.read(nconf.get('schema').summary, {
          user: fixtures.mockExpectedPseudo })
      })
      .tap(function(nothing) {
        expect(_.size(nothing)).to.be.equal(0);
      });
  });

  it("Save summary", function() {
    summary = _.map(analyzed, parse.finishSummary);
    const nowadays = new Date();
    summary = _.map(summary, function(e) {
      e.savingTime = nowadays;
      return e;
    });
    return mongo
      .insertMany(nconf.get('schema').summary, summary)
      .then(function() {
        return mongo.readOne(nconf.get('schema').summary, {
          user: fixtures.mockExpectedPseudo })
      })
      .tap(function(found) {
        expect(found.savingTime.toTimeString()).to.be.equal(nowadays.toTimeString());
      });
  });

  it(`Ensure nothing is lost in the tranfromation`, function() {
    expect(_.size(merged)).to.be.at.least(2);
    expect(_.size(merged)).to.be.equal(_.size(summary));
    console.log("\tsummarized metadata", _.size(summary));
  });

  it(`Save the metadata as described in /lib/parse`, function() {
    return parse.save(merged)
      .then(function(results) {
        debug("saved: %j", results);
      });
  });

  it(`Fail to salve Save the same metadata if 'repeat' is set`, function() {

  });

  it("Check checkMetadata (repeat=false)", function() {
    return Promise.map(merged, function(e) {
      return parse.checkMetadata(e, false);
    })
    .then(function(results) {
      let empty = _.first(results);
      expect(empty).to.be.equal(null);
    });
  });

  it("Check checkMetadata (repeat=true)", function() {
    return Promise.map(merged, function(e) {
      return parse.checkMetadata(e, true);
    })
    .then(function(results) {
      expect(results).to.be.equal(merged);
    });
  });
});
