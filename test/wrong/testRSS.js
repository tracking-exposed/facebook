const expect  = require("chai").expect;

const _ = require('lodash');
const Promise = require('bluebird');
const debug = require('debug')('test:RSS');
const nconf = require('nconf');
const moment = require('moment');

const rss = require("../lib/rss");
const utils = require('../lib/utils');
const mongo = require('../lib/mongo');
const fixtures = require('../lib/fixtures');

nconf.argv().env().file({ file: 'config/unitTest.json' });

describe("RSS semantic cleaning", function() {

  it("Remove previous DB entries and fix indexes", function() {
    return Promise.all([
      mongo.remove(nconf.get('schema').labels, fixtures.labelsCheck.filter),
      mongo.remove(nconf.get('schema').semantics, fixtures.semanticsCheck.filter),
      mongo.remove(nconf.get('schema').metadata, fixtures.metadataCheck.filter)
    ])
    .then(function() {
      return Promise.all([
        mongo.createIndex(nconf.get('schema').labels, { "semanticId" : 1 }),
        mongo.createIndex(nconf.get('schema').labels, { "when" : 1 }),

        mongo.createIndex(nconf.get('schema').metadata, { "id" : 1 }),
        mongo.createIndex(nconf.get('schema').metadata, { "semanticId" : 1 }),
        mongo.createIndex(nconf.get('schema').metadata, { "userId" : 1 }),
        mongo.createIndex(nconf.get('schema').metadata, { "semantic" : 1 }),

        mongo.createIndex(nconf.get('schema').semantics, { "semanticId" : 1 }),
        mongo.createIndex(nconf.get('schema').semantics, { "label" : 1 }),
        mongo.createIndex(nconf.get('schema').semantics, { "when" : 1 }),
      ])
    })
    .then(function(indexesNames) {
      expect(indexesNames).to.have.lengthOf(9);
    });
  });
});

describe("RSS semantic initialization", function() {

  it("Load mock semantic data into the DB", function() {
    return fixtures
      .createFakeSemantics(['labels', 'semantics', 'metadata'])
      .tap(function() {
        const cName = _.get(nconf.get('schema'), 'labels');
        return mongo
          .count(cName, fixtures.labelsCheck.filter)
          .tap(function(amount) {
            expect(amount).to.be.equal(fixtures.labelsCheck.expected);
          });
      })
      .tap(function() {
        const cName = _.get(nconf.get('schema'), 'semantics');
        return mongo
          .count(cName, fixtures.semanticsCheck.filter)
          .tap(function(amount) {
            expect(amount).to.be.equal(fixtures.semanticsCheck.expected);
          });
      })
      .tap(function() {
        const cName = _.get(nconf.get('schema'), 'metadata');
        return mongo
          .count(cName, fixtures.metadataCheck.filter)
          .tap(function(amount) {
            expect(amount).to.be.equal(fixtures.metadataCheck.expected);
          });
      })
  });
});

describe("RSS dummy generation (calls made by bin/buildrsserv.js)", function() {
  const labels = ['dummy1', 'dummy2' ];
  const dumfeedId = utils.hashList(labels);

  it("Clean database before testing", function() {
  });

  it("Compose an empty feed with a defult welcome message", function() {
    let produced = rss.produceDefault(labels, dumfeedId);
    expect(produced).to.match(/This\ newsfeed\ is/);
  });

  it("Create correctly a feedId", function() {
    expect(dumfeedId).to.be.a('string').equal(
      "01d0cf1897ae79ed531acfeb76a053ae1047a68b"
    );
  });

  it("create a dummy entry in `feeds` collection", function() {
    return mongo
      .remove(nconf.get('schema').feeds, { id: dumfeedId })
      .then(function() {
        return rss
          .rssRetriveOrCreate(['dummy1', 'dummy2'], dumfeedId)
          .catch(function(err) {
            expect(err.message).to.equal(rss.QUEUED_STRING);
            return null;
          })
          .then(function(anything) {
            expect(anything).to.equal(null);

            return mongo
              .readOne(nconf.get('schema').feeds, { id: dumfeedId });
          })
          .then(function(entry) {
            expect(entry.created).to.equal(false);
          });
      });
  });
});

describe("RSS mock generation (calls made by bin/buildrsserv.js)", function() {
  const mockL = [ _.first(_.first(fixtures.semanticMockUp.labels).l) ];
  const mockfeedId = utils.hashList(mockL);

  it("Create an entry with one label", function() {
    return mongo
      .remove(nconf.get('schema').feeds, { id: mockfeedId })
      .then(function() {
        return rss
          .rssRetriveOrCreate(mockL, mockfeedId)
          .catch(function(err) {
            expect(err.message).to.equal(rss.QUEUED_STRING);
            return null;
          });
      });
  });

  it("Check exists the freshly created `feed`", function() {
    return mongo
      .read(nconf.get('schema').feeds, { created: false })
      .then(function(feeds) {
        return _.find(feeds, { id: mockfeedId });
      })
      .then(function(feed) {
        expect(feed.labels).to.have.members(mockL);
      });

  });

  it("Fetch an empty feed list", function() {
    /* the labels in the DB should be too old for this */
    return rss.findMatchingFeeds(moment())
      .then(function(empty) {
        expect(empty).to.have.lengthOf(0);
      });
  });

  it("Update the field 'when' of the semantics to make it now", function() {
    const nowadays = new Date();
    return mongo
      .read(nconf.get('schema').semantics, {})
      .map(function(semantic) {
        semantic.when = nowadays;
        return mongo
          .updateOne(nconf.get('schema').semantics, {
            semanticId: semantic.semanticId, label: semantic.label
          }, semantic);
      }, { concurrency : 1})
      .then(function() {
        return mongo
          .read(nconf.get('schema').semantics, {})
          .then(_.sample);
      })
      .then(function(semantic) {
        expect(semantic.when.toString()).to.be.equal(nowadays.toString());
      });
  });

  it("Fetch our last feed", function() {
    return rss.findMatchingFeeds(moment().subtract(2, 'm'))
      /* should be cool double check GMT and timezone things */
      .tap(function(empty) {
        expect(empty).to.have.lengthOf(1);
      })
      .then(_.first)
      .then(function(empty) {
        expect(empty).to.have.all.keys(['_id', 'id', 'insertAt', 'labels', 'created']);
      });
  });

  it("Test retrieveNewData", function() {
    return rss
      .findMatchingFeeds(moment().subtract(2, 'm'))
      .map(function(feed) {
        const timelimit = new Date(moment().subtract(5, 'd'));
        return rss.retrieveNewData(feed, timelimit);
      })
      .then(_.first)
      .tap(function(blob) {
        const semanticId = _.first(blob)[2];
        const metadata = _.first(blob)[0];
        const label = _.first(blob)[1];

        expect(label.semanticId).to.be.equal(semanticId);
        expect(metadata.semanticId).to.be.equal(semanticId);
        expect(_.first(label.l)).to.be.equal(_.first(mockL));
      });
  });

  it("Test mergeSemanticLabel", function() {
    return rss
      .findMatchingFeeds(moment().subtract(2, 'm'))
      .map(function(feed) {
        const timelimit = new Date(moment().subtract(5, 'd'));
        return rss
            .retrieveNewData(feed, timelimit)
            .then(function(blob) {
                return rss.mergeSemanticLabel(feed, blob);
            });
      })
      .tap(function(product) {
          expect(product).to.has.lengthOf(1);
          const refLabel = _.first(_.first(product).label);
          expect( _.first(product).feed.labels)
              .to.include.members( [ _.first(refLabel.l) ] );
      })
  });

  it("Test composeXML mockup", function() {
    return rss
      .findMatchingFeeds(moment().subtract(2, 'm'))
      .map(rss.composeXMLfromFeed)
      .then(_.first)
      .then(function(material) {
        const rssOutput = material.composed.xml();
        const r = new RegExp(_.first(mockL));
        expect(rssOutput).to.match(r);
      });
  });


});
