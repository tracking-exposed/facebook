const _ = require('lodash');
const debug = require('debug')('routes:selector');
const nconf = require('nconf');

const utils = require('../lib/utils');
const mongo3 = require('../lib/mongo3');
const adopters = require('../lib/adopters');
const { head } = require('lodash');

const CURRENT_SELECTOR = 'div[data-pagelet^="FeedUnit"]';

async function userInfo(req) {
    /* the POST function returns:
     * - the W3C CSS selector currently used to spot posts
     * - the personal tokenId of the user
     */

    const headers = adopters.processHeaders(_.get(req, 'headers'));
    if(_.size(headers.errors))
        return debug("headers parsing error missing: %j", headers.errors);

    if (!utils.verifyRequestSignature(req)) {
        debug("request dropped: invalid signature, body of %d bytes, headers: %j",
            _.size(req.body), req.headers);
        return { 'json': {
            'status': 'error',
            'info': "Invalid signature"
        }};
    }

    const mongoc = await mongo3.clientConnect();
    let supporter = await mongo3.readOne(mongoc, nconf.get('schema').supporters, {
        publicKey: headers.publickey,
        userId: headers.supporterId,
    });

    if(!supporter) {
        supporter = await adopters.create(_.extend(headers, { userId: headers.supporterId}));
    }

    debug("userInfo %s (%s) returning token and selctor",
        supporter.pseudo, headers.version);

    await mongo3.writeOne(mongoc, nconf.get('schema').access, {
        paadc: headers.paadc,
        supporterId: supporter.userId,
        accessTime: new Date(),
        version: headers.version,
    });
    await mongoc.close();
    return {
        'json': {
            token: supporter.userSecret,
            pseudo: supporter.pseudo,
            keyTime: supporter.keyTime,
            lastAccess: supporter.keyTime,
            selector: CURRENT_SELECTOR
        }
    };
};

module.exports = {
    userInfo: userInfo
};
