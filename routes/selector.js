var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('route:selector');
var nconf = require('nconf');
 
var mongo = require('../lib/mongo');

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
     *   */
    return mongo
        .read(nconf.get('schema').supporters, {
            publicKey: req.body.publicKey,
            userId: _.parseInt(req.body.userId)
        })
        .then(_.first)
        .then(function(user) {
            if(user.optin !== req.body.optin)
                debug("we should do an optin update: %j", user.optin);

            var token = "unavailable";

            if(!user || !user.userSecret)
                debug("Odd race condition, token not available for %s", req.body.userId);
            else
                token = user.userSecret;

            debug("userInfo (%s): Success, returning token and the selctor", req.headers['x-fbtrex-version']);
            return {
                'json': {
                    token: token,
                    selector: '.userContentWrapper'
                }
            };
        })
        .catch(function(error) {
            debug("userInfo (%s): Failure, returning (dummy)token and the selctor", req.headers['x-fbtrex-version']);
            // TODO manage this token in the static page
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
    debug("LEGACY getSelector %s", req.headers['x-fbtrex-version']);
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
