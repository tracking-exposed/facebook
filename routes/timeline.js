const _ = require('lodash');
const debug = require('debug')('routes:timeline');
const nconf = require('nconf');

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

module.exports = {
    timelineCSV,
};
