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

/* two global variables ftw */
let firstLine = true;
const MAXBULK = 100;

try {
    main(reftime = new Date(moment(startString).toISOString()), cu);
} catch(e) {
    console.log("Error!", e.stack);
    process.exit(1);
}

async function main(start, usersArray) {
    const mongoc = await mongo.clientConnect();
    debug("%s", JSON.stringify(usersArray));
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

    let debugc = 0;
    for (const user of avail) {
        for (const since of user.skips) {
            let { datasize, csvsize, fl } = await processChunk(mongoc, user, since);
            if(!(debugc % 13))
                debug("retrieved %d records for %s (since %d) bytes %d [firstLine %s]", datasize, user.name, since, csvsize, fl);
            debugc++;
        }
    }
    debug("Completed CSV: %s", outputfcsv);
    await mongoc.close();
    process.exit(0);
}

async function processChunk(mongoc, user, since) {

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
            "authorName": ainfo ? ainfo.content: null, 
            "authorDisplay": ainfo ? ainfo.display: null,
            "timelineId": me.timelineId,
            "id": me.id,
            "attributions": _.size(me.attributions),
            "nature": me.nature,
            "impressionOrder": me.impressionOrder,
            "imgunmatch" : me.images ? me.images.unmatched : null,
            "imgprofiles" : me.images ? me.images.profiles : null,
            "imgview" : me.images ? me.images.others : null,
            "fblinktype": me.linkontime ? me.linkontime.fblinktype : null,
        };
    })

    const text = csv.produceSimpleCSV(cleanData, firstLine);
    fs.appendFileSync(outputfcsv, text, 'utf8'); 
    let inforv = {
        datasize: _.size(data),
        csvsize: _.size(text),
        fl: firstLine
    }
    firstLine = false;
    return inforv;
}