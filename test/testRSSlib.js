const expect    = require("chai").expect;
const _ = require('lodash');
const debug = require('debug')('test:rss');
const nconf = require('nconf');

const rss = require("../lib/rss");
const utils = require('../lib/utils');
const mongo = require('../lib/mongo');

nconf.argv().env().file({ file: 'config/content.json' });
nconf.set('mongodb', 'mongodb://localhost/fbtest');

describe("RSS feed generation (calls made by bin/buildrsserv.js)", function() {
    const labels = ['dummy1', 'dummy2' ];
    const feedId = utils.hashList(labels);

    describe("data utility", function() {
        debug(nconf.get('schema').feeds);
        debug("%j", nconf.get('schema'));
        expect(1).to.equal(1);
    });

    it("Clean database before testing", function() {
        return mongo
            .remove(nconf.get('schema').feeds, { id: feedId });
    });

    it("Compose an empty feed with a defult welcome message", function() {
        let produced = rss.produceDefault(labels, feedId);
        expect(produced).to.match(/This\ newsfeed\ is/);
    });

    it("Create correctly a feedId", function() {
        expect(feedId).to.be.a('string').equal("01d0cf1897ae79ed531acfeb76a053ae1047a68b");
    });

    it("Would create a new entry in `feeds` collection", function() {
        rss
            .rssRetriveOrCreate(['dummy1', 'dummy2'], feedId)
            .catch(function(err) {
                expect(err.message).to.equal(rss.QUEUED_STRING);
                return null;
            })
            .then(function(anything) {
                expect(anything).to.equal(null);

                return mongo
                    .readOne(nconf.get('schema').feeds, { id: feedId });
            })
            .then(function(entry) {
                expect(entry.labels[0]).to.equal(labels[0]);
                expect(entry.labels[1]).to.equal(labels[1]);
                expect(entry.created).to.equal(false);
                debug("%j", entry);
            });
    });



    //it("Would create a new entry in `feeds` collection", function() {
    //});

});
