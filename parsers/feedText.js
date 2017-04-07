#!/usr/bin/env nodejs
var _ = require('lodash');
var cheerio = require('cheerio');
var moment = require('moment');
var debug = require('debug')('feedText');
var parse = require('./lib/parse');

/* This parser extract the text available in the post and the 
 * related href if any */

function getText(snippet) {

    var $ = cheerio.load(snippet.html);
    var retO = { 'feedText': false };

    try {
        var s = $('.userContent');
        // debug("%s", s.text() );
        var rt = s.text();
    } catch(err) { }

    var cinque = $('h5');
    var sei = $('h6');
    var source, reason, comm;

    console.log(" ↓ " +
        [cinque.length, sei.length, _.size(rt), snippet.id].join(",") );

    try {
        source = sei['0'].children[0].children[0].children[0].children[0].data;
    } catch(error) { }

    debugger;
    if(cinque.length === 1) {
        if(_.isUndefined(source)) {
            debug("5 set source %s over (%d)", cinque.text(), _.size(source) );
            source = cinque.text();
        } else {
            reason = cinque.text();
            debug("Reason: %s", reason);
        }
    }

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
