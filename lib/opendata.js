var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('opendata');
var nconf = require('nconf');
 
var mongo = require('./mongo');

var queryContent = function(req) {
    debugger;
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

module.exports = {
    queryContent: queryContent
};
