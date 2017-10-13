var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('lib:opendata');
var nconf = require('nconf');
 
var mongo = require('./mongo');

var queryContent = function(req) {
    /* At the moment, only one content by ID can be requested */
    var Q = req.body;
    var avail = ['timelines', 'impressions', 'htmls'];
    var queid = /^[a-fA-F0-9]+$/.exec(Q.id);
    
    if(avail.indexOf(Q.column) === -1 || !queid)
        throw new Error("Invalid request");

    queid = _.first(queid);
    debug("%s Requested element id %s from %s",
        req.randomUnicode, queid, Q.column);

    return mongo
        .read(nconf.get('schema')[Q.column], { id: queid })
        .then(function(elementL) {
            var c =  _.first(elementL);
            if(Q.column === 'htmls')
                c = _.omit(c, ['html']);

            return {
                'json': {
                    'type': Q.column,
                    'element': c
                }
            };
        });
};

function getNodeNumbers() {
    var columns = [ "supporters", "timelines", "impressions", "htmls", "accesses" ];
    debug("getNodeStats %j", columns);
    return Promise.map(columns, function(cn) {
        return mongo.countByMatch(nconf.get('schema')[cn], {});
    })
    .then(function(numbers) {
        debug("node #%j", _.zipObject( columns, numbers));
        return _.zipObject( columns, numbers);
    });
};

function openDataHref(req) {

    var campaign = req.params.campaign;
    var MAX = _.parseInt(req.params.max) || 500;

    var filter = { feedHref: true };

    if(campaign && typeof nconf.get(campaign) === 'object') {
        var ids = _.map(nconf.get(campaign), function(user) {
            return _.parseInt(user.id);
        });
        filter.userId = { "$in": ids };
        debug("openDataHref campaign %s requested", campaign);
    } else 
        debug("openDataHref, generic query received max %d results", MAX);

    return mongo
        .readLimit(nconf.get('schema').htmls, filter, { savingTime: -1 }, MAX, 0)
        .reduce(function(memo, e) {
            _.each(e.externalHref, function(l) {
                var exists = _.find(memo, { link: l });
                if(exists)
                    exists.count += 1;
                else
                    memo.push({
                        count: 1,
                        link: l,
                        putime: moment(e.publicationUTime * 1000).toISOString()
                    });
            });
            return memo;
        }, [])
        .then(function(r) {
            debug("openDataHref returning %d links", _.size(r));
            return { json: _.orderBy(r, { putime: -1}) };
        });

};


module.exports = {
    queryContent: queryContent,
    getNodeNumbers: getNodeNumbers,
    openDataHref: openDataHref
};
