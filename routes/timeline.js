const _ = require('lodash');
const debug = require('debug')('routes:personal');
const nconf = require('nconf');

const mongo = require('../lib/mongo');
const utils = require('../lib/utils');
const csv = require('../lib/CSV');

function timelineCSV(req) {
    const timelineId = req.params.timelineId;
    const timelineP = utils.pseudonymizeTmln(timelineId);
    debug("timeline CSV request (Id %s -> p %s)", timelineId, timelineP);

    return mongo
        .read(nconf.get('schema').summary, { timeline: timelineP }, { impressionTime: -1})
        .then(csv.produceCSVv1)
        .tap(function(check) {
            if(!_.size(check)) throw new Error("Invalid timelineId");
        })
        .then(function(structured) {
            debug("timelineCSV produced %d bytes", _.size(structured));
            const fname=`timeline-${timelineP}.csv`;
            return {
                headers: { "Content-Type": "csv/text",
                           "content-disposition": `attachment; filename=${fname}` },
                text: structured,
            };
        });
}

module.exports = {
    timelineCSV,
};
