const _ = require('lodash');
const debug = require('debug')('routes:timeline');
const nconf = require('nconf');

const mongo = require('../lib/mongo');
const utils = require('../lib/utils');
const csv = require('../lib/CSV');

async function timelineCSV(req) {
    const timelineId = req.params.timelineId;
    const timelineP = utils.pseudonymizeTmln(timelineId);

    const m = await mongo.read(nconf.get('schema').metadata, { timelineId: timelineId }, { impressionTime: -1});
    debug("timeline CSV request (Id %s -> p %s) found %d metadatas", timelineId, timelineP, _.size(m));

    const content = _.map(m, function(metadata) {
        const omitf = ['_id', 'when', 'savingTime', 'paadc',
            'images', 'hrefs', 'meaningfulId', 'nature', 'texts'];
        metadata = _.extend(metadata, metadata.nature);
        metadata.picts = _.size(metadata.images);
        metadata.links = _.size(metadata.htmls);
        metadata.infos = _.size(metadata.meaningfulId);
        metadata.textContent = metadata.texts.join("<+>");
        metadata.textSize = _.size(metadata.texts.join(""));
        return _.omit(metadata, omitf);
    })
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
