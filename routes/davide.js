const _ = require('lodash');
const debug = require('debug')('routes:davide');
const nconf = require('nconf');
const moment = require('moment');

const mongo3 = require('../lib/mongo3');
const { LIMIT } = require('./public');

async function impressionList(req) {
    const filter = { timelineId: req.params.timelineId};
    const mongodriver = await mongo3.clientConnect({concurrency: 1});
    const content = await mongo3.readLimit(mongodriver, nconf.get('schema').impressions,
        filter, { impressionOrder: 1 }, LIMIT, 0
    );
    debug("Returned from DB %d impressions", _.size(content));
    await mongodriver.close();
    const clean = _.map(content, function(i) {
        return _.pick(i, ['impressionOrder', 'impressionTime', 'visibility', 'htmlId' ]);
    });
    return {json: clean};
}

async function bySource(req) {

    const publisherName = req.params.publisherName;
    const mongodriver = await mongo3.clientConnect({concurrency: 1});
    const filter = { publisherName };
    const content = await mongo3.readLimit(mongodriver, nconf.get('schema').metadata,
        filter, { impressionTime: -1 }, LIMIT, 0
    );
    debug("Returning from DB advertising %d elements (filtered as %j",
        _.size(content), filter);
    await mongodriver.close();

    // const startISO = moment("2020-12-28").add(weekn, 'week');
    const clean = _.map(content, function(e) {

        const dutchWords = ['Gesponsord', 'Betaald door'];
        const textmatch = _.first(e.texts) ?
            _.startsWith(_.first(e.texts), dutchWords[0]) :
            false;
        if(textmatch) {
            e.nature.kind = 'ad';
            e.nature.type = 'text match';
            e.nature.match = _.first(e.texts);
        }

        _.unset(e, 'userId');
        return e;
    });
    return { json: content };
}

module.exports = {
    bySource,
    impressionList,
};
