const expect    = require("chai").expect;
const nconf = require('nconf');
const _ = require('lodash');
const debug = require('debug')('tests:testDButils');

const dbutils = require('../lib/dbutils');
const mongo = require('../lib/mongo');

nconf.argv().env().file({ file: 'config/content.json' });

describe('db.utils.checkMongoWorks', function() {

    it('set a fake Mongo URI', function() {

        const mongoHost = '127.0.0.1';
        const mongoPort = 22; // I can'be belive would ever happen 
        const mongoDb = nconf.get('mongoDb');

        const fu = `mongodb://${mongoHost}:${mongoPort}/${mongoDb}`;
        mongo.mongoUri(fu);

        const check = mongo.mongoUri();
        expect(check).to.be.equal(fu);
    });

    it('Fail if an unreachable mongodb is found', async function() {
        try {
            await mongo.clientConnect();
            // this should fault 
            expect(true).to.be(false);
        } catch(error) {
            expect(true).to.be.true;
        }
    });

    it('still fail is properly tested', async function() {
        const ret = await dbutils.checkMongoWorks();
        expect(ret).to.be.false;
    });

    it('Works if has to', async function() {
        /* this makes load the default from nconf */
        mongo.mongoUri(null);
        const ret = await dbutils.checkMongoWorks();
        expect(ret).to.be.an('array');
    });
});

