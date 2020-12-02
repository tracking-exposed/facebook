const _ = require('lodash');
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
        const r = _.omit(e, ['userId', '_id' ]);
        r.images = _.filter(e.images, { linktype: 'cdn'});
        return r;
    })
    debug("Returning for advertising filtering, %d elements", _.size(redacted));
    await mongodriver.close();
    return { json: redacted };
};

module.exports = {
    ad,
};
