#!/usr/bin/env node
const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('parser:precise');
const nconf = require('nconf');

const walk = require('../lib/walk');
const parse = require('../lib/parse');
const mongo = require('../lib/mongo');
const glue = require('../lib/glue');

nconf.argv().env().file({ file: 'config/content.json' });

const targetId = nconf.get('id');
if(!targetId) {
    console.log("Required id as parameter");
    return;
}

const repeat = nconf.get('repeat') || false;
const htmlfilter = repeat ?
    { id: targetId } :
    { id: targetId, processed: { $exists: false } };

nconf.stores.env.readOnly = false;
nconf.set('fulldump', true);
nconf.set('retrive', true);
nconf.stores.env.readOnly = true;

return parse
    .parseHTML(htmlfilter, repeat)
    .then(function(done) {
        if(!done || !done.metadata)
            debug("No effect on targetId")
        else
            debug("Done targetId! %d metadata, %d errors", done.metadata, done.errors);
    });
