const _ = require('lodash');
const debug = require('debug')('routes:timeline');
const nconf = require('nconf');
const moment = require('moment');

const mongo = require('../lib/mongo');
const utils = require('../lib/utils');
const csv = require('../lib/CSV');
const trans = require('../lib/transformations');

async function timelineCSV(req) {
    const timelineId = req.params.timelineId;
    const timelineP = utils.pseudonymizeTmln(timelineId);

    const m = await mongo.read(nconf.get('schema').metadata, { timelineId: timelineId }, { impressionTime: -1});
    debug("timeline CSV request (Id %s -> p %s) found %d metadatas", timelineId, timelineP, _.size(m));

    const content = _.map(m, trans.metadataToSimple);
    if(!_.size(content))
        throw new Error("Invalid timelineId?");

    const structured = csv.internalCSV(content, _.keys(content[0]));
    debug("timelineCSV produced %d bytes", _.size(structured));
    const fname=`timeline-${timelineP}.csv`;
    return {
        headers: { "Content-Type": "csv/text",
                   "Content-Disposition": `attachment; filename=${fname}` },
        text: structured,
    };
}

async function impressionStatsLegacy(req) {
    throw new Error("Not implemented yet")
    debugger;
}
async function impressionStats(req) {
    const dayString = req.params.day;
    if(!dayString || !dayString.match(/(\d+)-(\d+)-(\d+)/))
        throw new Error("Invalid date format")
    const when = moment(dayString);
    const startOf = new Date(when.startOf('day').toISOString());
    const endOf = new Date(when.add(1, 'd').startOf('day').toISOString());

    if(!startOf || !endOf)
        throw new Error("Errorfull date parsing?");

    const enhancedimpr = await mongo.aggregate(
        nconf.get('schema').impressions, [
            { "$match": { impressionTime: { $lt: endOf, $gt: startOf }}},
            { "$lookup": { from: 'htmls2', localField: 'htmlId', foreignField: 'id', as: 'hinfo' }},
            { "$lookup": { from: 'metadata2', localField: 'htmlId', foreignField: 'id', as: 'metadata' }}
        ]);
    /* an enhanced impression object has these fields: {
        "visibility" : "public",
        "kind" : "post",
        "timelineId" : "153062305c6273641a5b3c57b790671fd38e7f7a",
        "id" : "b0cf934f33da4898af5139fccbe9822cc765ea62",
        "userId" : 3217423097589078284827374297823,
        "impressionOrder" : 19,
        "impressionTime" : ISODate("2020-12-20T21:25:12.542Z"),
        "htmlId" : "5e26ae0ca1dd93dfb33c316a390d705d58f34e9d",
        "metadata" : [ {
            "texts" : [ 
                "Pensa a un’auto elettrica che ti permetta di ritrovare ciò che rende "
            ],
            "nature" : {
                "kind" : "ad",
                "from" : "standard",
                "visibility" : "public"
            },
            "pseudo" : "okra-ravioli-tapioca",
        }
    ]}  */
    const grouped = _.groupBy(enhancedimpr, 'timelineId');
    /* this aggregate in an object for every timelineId */
    const final = _.reduce(grouped, function(memo, impressions) {
        const x = {};
        const ordered = _.orderBy(impressions, 'impressionOrder');
        x.sessionId = utils.hash({
            'uuid': impressions[0].userId,
            'uutimeline': impressions[0].timelindId
        });
        x.sessionTimings = [];
        x.info = [];
        _.each(ordered, function(impression) {
            /* here copy visibility|kind into a list ordered by impression order */
            const nature = _.get(_.first(_.get(impression, 'metadata', [])), 'nature');
            const adorpost = nature ? nature.kind : impression.kind;
            const info = (impression.visibility === 'private') ? 'private' :
                adorpost === 'post' ? 'organic' : adorpost;
            /* debug("copying %s Order %d array position %d",
                info, impression.impressionOrder, _.size(x.info) ); */
            x.info.push(info);
            x.sessionTimings.push(impression.impressionTime);
        });
        /* 'x' is an object for every session, the collection
               contains all the evidence per day requested.

            sessionId "3f78aa4e03788fcb0d425842572eefbf2c002327"
            sessionTimings
                0	"2020-12-20T18:27:59.123Z"
                1	"2020-12-20T18:27:59.136Z"
                2	"2020-12-20T18:28:05.402Z"
                3	"2020-12-20T18:28:05.462Z"
                4	"2020-12-20T18:28:05.467Z"
                5	"2020-12-20T18:28:05.478Z"
                6	"2020-12-20T18:28:05.508Z"
                7	"2020-12-20T18:28:11.030Z"
                8	"2020-12-20T18:28:11.095Z"
                9	"2020-12-20T18:28:11.149Z"
                10	"2020-12-20T18:28:11.198Z"
            info
                0	"organic"
                1	"ad"
                2	"organic"
                3	"organic"
                4	"organic"
                5	"private"
                6	"ad"
                7	"organic"
                8	"organic"
                9	"organic"
                10	"private"                */
        memo.push(x);
        return memo;
    }, []);
    debug("Producing %s %d collected session", dayString, _.size(final));
    return { json: final };
}

module.exports = {
    timelineCSV,
    impressionStats,
    impressionStatsLegacy,
};
