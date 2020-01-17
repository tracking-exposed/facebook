const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');
const debug = require('debug')('routes:selector');
const nconf = require('nconf');

const utils = require('../lib/utils');
const mongo = require('../lib/mongo');
const adopters = require('../lib/adopters');
const echoes = require('../lib/echoes');

/* this file contains getSelector and userInfo,
 *                        GET /api/v1/selector
 *                              - should be discontinued
 *                        POST /api/v1/userInfo
 *                              - should be stabilized
 */

const CURRENT_SELECTOR = '.userContentWrapper';

function userInfo(req) {
    /* the POST function returns:
     * - the W3C CSS selector currently used to spot posts
     * - the personal tokenId of the user
     */

    if (!utils.verifyRequestSignature(req)) {
        debug("request dropped: invalid signature, body of %d bytes, headers: %j",
            _.size(req.body), req.headers);
        return { 'json': {
            'status': 'error',
            'info': "Invalid signature"
        }};
    }

    return mongo
        .read(nconf.get('schema').supporters, {
            publicKey: req.body.publicKey,
            userId: _.parseInt(req.body.userId)
        })
        .then(function(supporterL) {
            if(!_.size(supporterL))
                return adopters.create(req.headers);

            if(_.size(supporterL) > 1)
                debug("Error: %j -- duplicated supporter", supporterL);

            return _.first(supporterL);
        })
        .then(function(supporter) {
            if(supporter.optin !== req.body.optin) {
                // debug("we should do an optin update: %j != %j", user.optin, req.body.optin);
                // deal with this when we have a situation of multiple opt-in
            }
            debug("userInfo %s (%s) returning token and selctor",
                supporter.pseudo, req.headers['x-fbtrex-version']);

            echoes.echo({
                index: 'handshake',
                pseudo: supporter.pseudo,
                version: supporter.version
            });
            // trivia: the version update happen at the submission, not here

            return {
                'json': {
                    token: supporter.userSecret,
                    selector: CURRENT_SELECTOR
                }
            };
        })
        .catch(function(error) {
            debug("userInfo (%s): error [%s] returning (dummy)token [%s]",
                req.headers['x-fbtrex-version'],
                error.message, req.headers['x-fbtrex-userid']);

            echoes.echo({
                index: 'handshake',
                pseudo: "undefined",
                version: req.headers['x-fbtrex-userid']
            });

            return {
                'json': {
                    token: 'error',
                    selector: CURRENT_SELECTOR
                }
            };
        });
};

function getSelector(req) {
    /* the GET function returns:
     * - the W3C CSS selector currently used to spot posts
     */
    debug("LEGACY getSelector %s from %s",
        req.headers['x-fbtrex-version'], req.headers['x-fbtrex-userid']);

    echoes.echo({
        index: 'handshake',
        pseudo: "unsupported",
        version: req.headers['x-fbtrex-version']
    });

    return {
        'json': {
            'selector': CURRENT_SELECTOR
        }
    };
};

module.exports = {
    getSelector: getSelector,
    userInfo: userInfo
};
