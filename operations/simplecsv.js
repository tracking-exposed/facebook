#!/usr/bin/env node
const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('operations:simplecsv');
const nconf = require('nconf');
const fs = require('fs');

const mongo = require('../lib/mongo3');
const csv = require('../lib/CSV');

nconf.argv().env();
const inputf = nconf.get('input');
const outputfcsv = nconf.get('output');
if(!inputf || !outputfcsv) {
    console.log("required --input with a configuration json (start+users), and --output (which is appended!)");
    process.exit(1);
}

debug("Using inputfile as %s", inputf);
nconf.file({ 'file': inputf });
const startString = nconf.get('start');
const cu = nconf.get('users');
debug("Starting since %s there are %d users", startString, _.size(cu));

const defaultConf = nconf.get('config') || 'config/content.json';
nconf.file({ file: defaultConf });

try {
    main(reftime = new Date(moment(startString).toISOString()), cu);
} catch(e) {
    console.log("Error!", e.stack);
    process.exit(1);
}

async function main(start, usersArray) {
    const mongoc = await mongo.clientConnect();
    debug("%s", JSON.stringify(usersArray));
    const MAXBULK = 300;
    const avail = [];

    for (const u of usersArray) {

        const supporter = await mongo.read(mongoc, nconf.get('schema').supporters, {userSecret: u[1]});

        if(!supporter || !supporter[0].userId) {
            debug("Supporter [%s] not found in the DB!", u[0]); 
        } else {
            const amount = await mongo.count(mongoc, nconf.get('schema').metadata, {
                impressionTime: { $gt: reftime },
                userId: supporter[0].userId
            });
            let rv = {
                name: u[0],
                amount,
                supporter: _.first(supporter),
                skips:  _.times( (amount / MAXBULK) + 1, function(i) {
                    return i * MAXBULK;
                })
            };
            avail.push(rv);
        }
    }

    debug("%d users matching with content: %j", _.size(avail), 
        _.map(avail, function(e) {
            return _.pick(e, ['name', 'amount']);
        })
    );

    let firstLine = true;
    for (const user of avail) {
        for (const since of user.skips) {

            const data = await mongo.readLimit(mongoc, nconf.get('schema').metadata, {
                impressionTime: { $gt: reftime },
                userId: user.supporter.userId
            }, { impressionTime: 1 }, MAXBULK, since);

            const cleanData = _.map(data, function(me) {
                const ainfo = _.find(me.attributions, { type: 'authorName' });
                return {
                    "impressionTime": me.impressionTime,
                    "postId": me.postId,
                    "name": user.name,
                    "fullTextSize": me.fullTextSize,
                    "authorName": ainfo ? ainfo.content: "none", 
                    "authorDisplay": ainfo ? ainfo.display: "none",
                    "timelineId": me.timelineId,
                    "id": me.id,
                    "nature": me.nature,
                    "errors": _.size(me.errors),
                    "images" : _.size(me.images)
                };
            })

            const text = csv.produceSimpleCSV(cleanData, firstLine);
            debug("retrieved %d records for %s (since %d) bytes %d [firstLine %s]",
                _.size(data), user.name, since, _.size(text), firstLine);
            fs.appendFileSync(outputfcsv, text, 'utf8'); 
            firstLine = false;
        }
    }
    debug("Completed CSV: %s", outputfcsv);
    await mongoc.close();
    process.exit(0);
}