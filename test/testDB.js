const expect    = require("chai").expect;
const mongo = require('../lib/mongo');
const nconf = require('nconf');
const _ = require('lodash');
const debug = require('debug')('tests:testDB');

nconf.argv().env().file({ file: 'config/content.json' });

describe('test the configuration', function() {
    it('has the right parameters', function() {
        const mongoHost = nconf.get('mongoHost');
        const mongoPort = nconf.get('mongoPort');
        const mongoDb = nconf.get('mongoDb');

        expect(mongoHost).to.be.a('string');
        expect(mongoPort).to.be.a('string');
        expect(mongoDb).to.be.a('string');
        expect(mongoDb).to.be.equal('facebook');

        const check = _.parseInt(mongoPort);
        expect(check).to.be.not.equal(NaN);
        expect(mongoPort).to.have.lengthOf(_.size(check + ""));
    });
});

function getRandDoc(input) {
    return {
        value: _.random(0, 1000),
        id: input ? input : _.random(0, 0xffff)
    };
};

const mongoHost = nconf.get('mongoHost');
const mongoPort = nconf.get('mongoPort');
const mongoDb = 'test'; // normally is 'facebook';
const mongoUri = `mongodb://${mongoHost}:${mongoPort}/${mongoDb}`;
const testC = 'io';

describe('mongoDB connection', function () {
    it('is something there?', async function() {
        debug("Connecting to %s", mongoUri);
        const mongoc = await mongo.clientConnect({uri: mongoUri});
        expect(mongoc).to.be.an('object');
        const l = await mongo.listCollections(mongoc);
        await mongoc.close();

        debug("Collections found: %d", _.size(l));
        expect(l).to.be.an('array').that.is.not.empty;
    });
});

describe('mongoDB APIs', function () {
    it('writeOne and writeMany', async function() {
        const mongoc = await mongo.clientConnect({uri: mongoUri});
        const doc = getRandDoc();
        const r = await mongo.writeOne(mongoc, testC, doc);
        expect(r.result.ok).to.be.equal(1);
        expect(r.result.n).to.be.equal(1);

        const many = 10;
        const docs = _.times(many, getRandDoc);
        const s = await mongo.writeMany(mongoc, testC, docs);
        expect(s.result.ok).to.be.equal(1);
        expect(s.result.n).to.be.equal(many);

        await mongoc.close();
    });

    it('remove, upsertOne, readOne, and updateOne', async function() {
        const mongoc = await mongo.clientConnect({uri: mongoUri});

        const i = await mongo.remove(mongoc, testC, {id: "ciao"});

        let doc = getRandDoc('ciao');

        const r = await mongo.upsertOne(mongoc, testC, {id: "ciao"}, doc);
        expect(r.result.ok).to.be.equal(1);
        expect(r.result.n).to.be.equal(1);
        expect(r.result.nModified).to.be.equal(1);

        const nope = await mongo.upsertOne(mongoc, testC, {id: "ciao"}, doc);
        expect(nope.result.ok).to.be.equal(1);
        expect(nope.result.n).to.be.equal(1);
        expect(nope.result.nModified).to.be.equal(0);

        const check = await mongo.readOne(mongoc, testC, {id: "ciao"});
        expect(check.value).to.be.equal(doc.value);

        doc.value = "a";
        doc.plus = true;

        const s = await mongo.upsertOne(mongoc, testC, {id: "ciao"}, doc);
        debug("%j", s);
        expect(s.result.ok).to.be.equal(1);
        expect(s.result.n).to.be.equal(1);

    });

});
