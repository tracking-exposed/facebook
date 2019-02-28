const _ = require('lodash');
const expect    = require("chai").expect;
const nconf = require("nconf");
const Promise = require("bluebird");
const moment = require("moment");
const debug = require("debug")("test:1ParsingPhase");

const mongo = require("../lib/mongo");
const parse = require('../lib/parse');
const fixtures = require('../lib/fixtures');

nconf.argv().env().file({ file: "config/unitTest.json" });

describe("Parsing the HTMLs", function() {

  let merge = [];
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
      });
  });

});
