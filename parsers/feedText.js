#!/usr/bin/env nodejs
var _ = require('lodash');
var cheerio = require('cheerio');
var moment = require('moment');
var debug = require('debug')('feedText');
var parse = require('./lib/parse');

/* This parser extract the text available in the post and the 
 * related href if any; the complexity here is starting to be
 * huge, it is better if I'll use this as experiment for 
 * language-dependned analysis and extraction */

var commentsR = [ /Comments$/, /Comentarios$/, /Commenti$/, /Comentári$/ ];
var translation = [ /Visualizza traduzione$/ ];

function mapReduceTrim(reglist, stext) {
    return _.reduce(reglist, function(memo, regex) {
        if( !stext || !_.size(stext) )
            return memo;
        if(!_.isNull(memo))
            return memo;
        var c = _.trimEnd(stext, regex);
        if(_.size(c) !== _.size(stext))
            return c;
        return memo;
    }, null);
}

function getText(snippet) {

    var $ = cheerio.load(snippet.html);
    var retO = { 'feedText': false };

    try {
        var s = $('.userContent');
        var extractedT = s.text();
        var rt = mapReduceTrim(translation, extractedT);
    } catch(err) { }

    var h5 = $('h5');
    var cinque = h5.text();
    var h6 = $('h6');
    var sei = h6.text();
    var source, reason;

    console.log(" ↓ " +
        [ "H", h5.length, h6.length, "T", cinque.length, sei.length,
          _.size(rt), snippet.id ].join(",")
    );

    source = mapReduceTrim(commentsR, sei);
    if(!source) {
        source = mapReduceTrim(commentsR, cinque);
    } else {
        reason = cinque;
        debug("Reason: %s", reason);
    }
    /*
    try {
        source = mapReduceTrim(commentsR, sei);
        if(!source)
            debug("Despite the possibilities: no `source` %s", sei);
        else
            debug("----» %s", source);
    } catch(error) {
        debug("Error in looking for `sei` %s: %s", sei, error);
    }

    debugger;
    if(cinque.length === 1) {
        if(_.isUndefined(source)) {
            debug("5 set source %s over (%d)", cinque, _.size(source) );
            source = cinque;
        } else {
            reason = cinque;
            debug("Reason: %s", reason);
        }
    }
    */
    debug("→ s[%s] T[%s] r[%s]", source, rt, reason);
    if(_.size(source)) {

        retO.feedText = true;

        _.extend(retO, { source: source });

        if(_.size(rt))
            _.extend(retO, { text: rt });

        if(_.size(reason))
            _.extend(retO, { reason: reason });

    } else {
        debug("øø unable to get .userContent and source: %s", snippet.id);
        return retO;
    }
};

var postHref = {
    'name': 'feedText',
    'requirements': { 'hrefType': 'post' },
    'implementation': getText,
    'since': "2016-09-13",
    'until': moment().toISOString(),
};

return parse.please(postHref);
