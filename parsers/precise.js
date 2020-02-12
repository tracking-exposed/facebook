#!/usr/bin/env node
const nconf = require('nconf');
const debug = require('debug')('parsers:precise');
const parse = require('../lib/parse');

nconf.argv().env().file({ file: 'config/content.json' });

const targetId = nconf.get('id');
if(!targetId) {
    console.log("Required id as parameter");
    return;
}

nconf.stores.env.readOnly = false;
nconf.set('fulldump', true);
nconf.set('retrive', true);
nconf.stores.env.readOnly = true;

async function main(htmlfilter) {
    const result = await parse.parseHTML(htmlfilter, repeat);
    if(!result || !result.metadata)
        debug("No effect on targetId")
    else
        debug("Done targetId! %d metadata, %d errors", result.metadata, result.errors);
    return result;
};

const repeat = nconf.get('repeat') || false;
return main(repeat ?
    { id: targetId } :
    { id: targetId, processed: { $exists: false } });
