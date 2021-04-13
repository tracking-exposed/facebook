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

    debug("Match supporter %s (%d)", supporter.pseudo, _.size(supporter));
    pipeline = _.concat([
        { $match: { pseudo: supporter.pseudo } },
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
        _.set(e, 'user', supporter.pseudo);
        // e.images = _.filter(e.images, {linktype: 'cdn'});
        e = _.omit(e, ['_id', 'pseudo', 'paadc', 'labelcopy', 'regexp',
            'opengraph',
            'usertext', 'interactions', 'images.profiles', 'indicators',
            'summary', 'userId', 'notes', 'when' ]);
        return e;
    });

    const fname = supporter.pseudo + "-" + _.size(prod);
    debug("Returning %d enriched entries in '%s' file", _.size(prod), fname);
    if(!_.size(prod)) {
        console.log(" (bad condition spot: closing)"); process.exit(1);
    }
    fs.writeFileSync(fname, JSON.stringify(prod, undefined, 2), "utf-8");
}

try {
    if(!nconf.get('token'))
        return console.log("--token required");
    personalEnrich();
} catch(error) {
    console.log(error);
}