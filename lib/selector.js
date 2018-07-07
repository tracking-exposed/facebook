var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:userInfo');
var nconf = require('nconf');
 
var mongo = require('./mongo');

/* this file contains getSelector and userInfo,
 *                        GET /api/v1/selector
 *                              - should be discontinued
 *                        POST /api/v1/userInfo
 *                              - should be stabilized
 */

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
            var token = "unavailable";
            if(!user || !user.userSecret)
                debug("Odd race condition, token not available for %s", req.body.userId);
            else
                token = user.userSecret;

            return {
                'json': {
                    token: token,
                    selector: '.userContentWrapper'
                }
            };
        });
};

function getSelector(req) {
    /* the GET function returns:
     * - the W3C CSS selector currently used to spot posts
     */
    debug("getSelector %s", req.headers['x-fbtrex-version']);
    return {
        'json': {
            // 'selector': '.fbUserStory',
            'selector': '.userContentWrapper'
        }
    };
};

module.exports = {
    getSelector: getSelector,
    userInfo: userInfo
};
