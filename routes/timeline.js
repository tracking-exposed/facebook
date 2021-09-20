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
    debug(req.params.day);
    const xx = req.params.day;
    const when = moment(xx);
    const startOf = new Date(when.startOf('day').toISOString());
    const endOf = new Date(when.add(1, 'd').startOf('day').toISOString());

    if(!startOf || !endOf)
        throw new Error("Errorfull date parsing?");

    const impresslists = await mongo.read(nconf.get('schema').impressions,
        { impressionTime: { $lt: endOf, $gt: startOf } }
    );
    /* an impression object has these fields: {
        "_id" : ObjectId("5fe1cfb7e0fc454e9c842945"),
        "visibility" : "private",
        "from" : "standard",
        "kind" : "post",
        "timelineId" : "325b979b77444fa341079cc2d7dbe4a6351ba522",
        "id" : "b0cf934ff7da4898af5139fccbe9822cc765ea62",
        "userId" : 3217423097589078284827374297823,
        "impressionOrder" : 19,
        "impressionTime" : ISODate("2020-12-22T10:51:35.686Z")
    } */

    const grouped = _.groupBy(impresslists, 'timelineId');
    /* this aggregate in an object for every timelineId */
    const final = _.reduce(grouped, function(memo, impressions, timelineId) {
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
            const info = (impression.visibility === 'private') ? 'private' :
                (impression.kind === 'post' ? 'organic' : impression.kind); // 'ad'
            /* debug("copying %s Order %d array position %d",
                info, impression.impressionOrder, _.size(x.info) ); */
            x.info.push(info);
            x.sessionTimings.push(impression.impressionTime);
        });
        /* x is:
            sessionId	"2b87726ae4a2d5fd316da929da1a5e3dd0a33681"
            sessionTimings
            0	"2020-12-23T14:34:52.965Z"
            1	"2020-12-23T14:34:52.966Z"
            2	"2020-12-23T14:34:54.006Z"
            3	"2020-12-23T14:34:54.006Z"
            4	"2020-12-23T14:34:54.007Z"
            5	"2020-12-23T14:34:54.007Z"
            6	"2020-12-23T14:34:54.008Z"
            info
            0	"organic"
            1	"organic"
            2	"private"
            3	"organic"
            4	"organic"
            5	"private"
            6	"organic"            */
        memo.push(x);
        return memo;
    }, []);
    return { json: final };
}

module.exports = {
    timelineCSV,
    impressionStats,
    impressionStatsLegacy,
};
