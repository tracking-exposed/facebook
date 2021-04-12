const _ = require('lodash');
const fs = require('fs');
const mongo = require('../lib/mongo');
const { enrich } = require("../routes/personal");
const debug = require('debug')('bin:personal');
const adopters = require('../lib/adopters');
const nconf = require('nconf');

nconf.argv().env().file({ file: 'config/content.json' });

async function personalEnrich() {

    const lookup = [
        { $lookup: {
            from: 'labels',
            localField: 'semanticId',
            foreignField: 'semanticId',
            as: 'labelcopy'
        }}
    ];
    const amount = 7000;
    const supporter = await adopters.validateToken(nconf.get('token'));

    pipeline = _.concat([
        { $match: { user: supporter.pseudo } },
        { $sort: { impressionTime: -1 } },
        { $skip: 0 },
        { $limit: amount },
    ], lookup);

    const agg = await mongo.aggregate(nconf.get('schema').metadata, pipeline);

    const prod = _.map(agg, function(e) {
        if(_.size(e.labelcopy)) {
            e.labels = _.get(e.labelcopy[0], 'l');
            e.lang = _.get(e.labelcopy[0], 'lang');
        }
        _.set(e, 'user', pseudo);
        e.images = _.filter(e.images, {linktype: 'cdn'});
        e = _.omit(e, ['_id', 'pseudo', 'paadc', 'labelcopy', 'regexp', 'opengraph',
            'usertext', 'interactions', 'images.profiles', 'indicators',
            'summary', 'userId', 'notes', 'when' ]);
        return e;
    });

    debug("Returning %d enriched entries in 'personal.json' file", _.size(prod));
    if(!_.size(prod)) {
        console.log(" (bad condition spot: closing)"); process.exit(1);
    }
    fs.writeFileSync("personal.json", JSON.stringify(prod, undefined, 2), "utf-8");
}

try {
    if(!nconf.get('token'))
        return console.log("--token required");
    personalEnrich();
} catch(error) {
    console.log(error);
}