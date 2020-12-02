const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('routes:public');
const nconf = require('nconf');

const mongo3 = require('../lib/mongo3');

async function ad(req) {
    // req has optional 'selector'
    debug("accessing to look for ad")
    const mongodriver = await mongo3.clientConnect({concurrency: 1});
    const content = await mongo3.readLimit(mongodriver, nconf.get('schema').metadata, {
        "nature.kind": 'ad',
    }, { impressionTime: -1 }, 300, 0);
    const redacted = _.map(content, function(e) {
        return _.omit(e, ['userId']);
    })
    debug("Returning for advertising filtering, %d elements", _.size(redacted));
    await mongodriver.close();
    return { json: content };
};

module.exports = {
    ad,
};
