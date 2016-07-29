var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('token');

var tokens = [];
var tokenFailures = [];
var internalCounter = 0;
var TOKEN_LIFETIME = 30; 
var TOKEN_KINDS = {
    "feed": 30,
    "suggestion": 30
};

var isValidToken = function(ipaddr, kind, profileId, tokenId) {

    if( _.isNaN(tokenId) || _.isNaN(profileId) || 
        _.isUndefined(tokenId) || _.isUndefined(profileId) )
        return false;

    if( (tokenId).constructor !== Number || 
        (profileId).constructor !== Number )
        throw new Error("Claudio you are supposed to have INT here");

    var t = _.find(tokens, {tokenId: tokenId});
    if(_.isUndefined(t))
        return false;

    if(!(t.profileId === profileId)) {
        tokenReport({
            'where': 'validation', 
            'reason': 'wrong profile id',
            'kind': kind,
            'profileId': profileId,
            'contextual': {'tokenProfileId': t.profileId },
            'when': moment().format()
        });
        return false;
    }
    
    if(!(t.ipaddr === ipaddr)) {
        tokenReport({
            'where': 'validation', 
            'reason': 'wrong ip associated',
            'kind': kind,
            'profileId': profileId,
            'contextual': {'tokenIP': t.ipaddr, 'submissionIP': ipaddr },
            'when': moment().format()
        });
        return false;
    }

    if (t.when.isAfter( moment().subtract(TOKEN_LIFETIME, 's') ))
        return true;

    /* else, is expired */
    tokenReport({
        'where': 'validation', 
        'reason': 'used an expired token',
        'kind': kind,
        'profileId': profileId,
        'contextual': {'created': t.when.format(), 'diff': 'TODO' },
        'when': moment().format()
    });

    _.remove(tokens, {
        tokenId: tokenId,
        profileId: profileId, 
        ipaddr: t.ipaddr
    });
    return false;
};

var canIgiveNewToken = function(ipaddr, kind, profileId) {
    /* check the kind, and if for the ipaddress a token of such kind
     * can still be produced, and if some token are expired 
     * -- TODO whitelist for special IP */

    var maxTPIP = TOKEN_KINDS[kind];
    if(_.isUndefined(maxTPIP)) return false;
    var tokenPerIP = _.find(tokens, {ipaddr: ipaddr });

    /* just for research */
    var research = _.find(tokenPerIP, {profileId: profileId});
    if(_.size(research)) {
        tokenReport({
            'where': 'evaluation', 
            'reason': 'token duplication',
            'kind': kind,
            'profileId': profileId,
            'contextual': { 'howmany': _.size(research) },
            'when': moment().format()
        });
    }

    var retval = (_.size(_.find(tokens, {ipaddr: ipaddr })) < maxTPIP);
    if(!retval) {
        tokenReport({
            'where': 'evaluation', 
            'reason': 'token overflow',
            'kind': kind,
            'profileId': profileId,
            'contextual': null,
            'when': moment().format()
        });
    }
    return retval;
}

var issueToken = function(ipaddr, kind, profileId) {

    var token = {
        tokenId: _.random(0, 0xffff),
        ipaddr: ipaddr,
        kind: kind,
        profileId: profileId,
        when: moment(),
        counter: internalCounter,
    };
    internalCounter += 1;
    tokens.push(token);
    return token;

};

var tokenReport = function(infodict) {
    debug("New error reported from '%s': '%s', current queue %d", 
        infodict.where, infodict.reason, _.size(tokenFailures));
    tokenFailures.push(infodict);
};

var invalidateToken = function(ipaddr, kind, profileId, tokenId) {
    _.remove(tokens, {tokenId: tokenId});
};

var periodicCheck = function() {

    if(_.size(tokens) > 0) {
      var lastUsable = moment().subtract(TOKEN_LIFETIME, 's');
      debug("+periodicCheck with a token queue of %d", _.size(tokens));
      _.remove(tokens, function(te) {
          return (te.when < lastUsable);
      });
      debug("-periodicCheck ends with %d tokens", _.size(tokens));
    }
    setTimeout(periodicInvadation, TOKEN_LIFETIME);
};

var pickLastError = function() {
    return _.last(tokenFailures);
};

module.exports = {
    isValidToken: isValidToken,
    canIgiveNewToken: canIgiveNewToken,
    issueToken: issueToken,
    tokenReport: tokenReport,
    tokenLifetime: TOKEN_LIFETIME,
    tokenKinds: TOKEN_KINDS,
    tokens: tokens,               // maybe masked ?
    tokenFailures: tokenFailures, // maybe masked ?
    pickLastError: pickLastError,
    invalidateToken: invalidateToken
};
