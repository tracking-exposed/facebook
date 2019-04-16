#!/usr/bin/env node
const j2c = require('json-2-csv');
const fs = require('fs').promises;
const nconf = require('nconf');
const debug = require('debug')('csv2mongo');
const _ = require('lodash');

const mongo = require('../lib/mongo');

nconf.argv().env();
const configF = nconf.get('config') || 'config/importer.json';
nconf.argv().env().file({ file: configF });

async function readFile(csvFile) {
    // in an async function:
    let data = await fs.readFile(csvFile);
    data = data.toString();
    debug("Imported %d bytes from %s", _.size(data), csvFile);
    return data;
}

async function csvConversion(data) {
    const options = {
        delimiter: { field: undefined,
                     wrap: undefined,
                     eol: undefined },
        excelBOM: false,
        trimHeaderFields: false,
        trimFieldValues: false,
        keys: undefined
    };
    return await j2c.csv2jsonAsync(data, options);
};

function mandatory(what) {
    console.log(`mandatory ${what} as --longoption or in ${configF}`);
    process.exit(1);
}

function findPostId(str) {
    if(str.match(/fbid/))
        return _.parseInt(str.replace(/.*fbid=/, '').replace(/\&.*/, '')) + "";
    else if(str.match(/photos/)) 
        // '/ABCes/photos/a.244549769895/10158814373899896'
        return str.split('/').pop();
    else
        throw new Error(`unsupported URL schema: ${str}`);
}

(async () => {
    try {
        const srcf = nconf.get('source');
        if(!srcf) mandatody("'source', the CSV file");

        const collection = nconf.get('collection');
        const mongodb = nconf.get('mongoDb');
        if(!collection || !mongodb) mandatory("'collection' and 'mongodb'");

        const name = nconf.get('name');
        if(!name) mandatory("'name' is one of the index");

        let data = await readFile(srcf);
        let converted = await csvConversion(data);

        if(_.get(converted[0], 'name')) {
            console.log("Error/Warning: if 'name' is set as key, we shouldn't really overwrite it");
            process.exit(1);
        }

        let jsonized = _.map(converted, function(e) {
            e.name = name;
            e['url'] = e['url\r']; // ... 
            _.unset(e, 'url\r');
            e.postId = findPostId(e['url']);
            e.publicationDay = new Date(e.date);
            return e;
        });
        const mongoc = await mongo.clientConnect();
        const u = await mongo.createIndex(mongoc, collection, { postId: 1}, {unique: true});
        const t = await mongo.createIndex(mongoc, collection, { publicationDay: 1});
        debug("writing on [%s] %d posts", collection, _.size(jsonized));
        const results = await mongo.insertMany(mongoc, collection, jsonized, { ordered: false});
        debug("results, insertedCount: %d", results.insertedCount);
        process.exit(0);
    } catch (e) {
        if(!e.writeErrors) {
            console.log(`Unexpected error: ${e.message}`);
            process.exit(1);
        }
        const errors = _.reject(e.writeErrors, { code: 11000 });
        debug("Received %d writeErrors, and %d not duplication-related",
            _.size(e.writeErrors), _.size(errors));

        process.exit(_.size(errors) ? 1: 0 );
    }
})();
