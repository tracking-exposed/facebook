#!/usr/bin/env node
var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('parsers:components:text');

/* This parser extract the text available in the post and the 
 * related href if any; the complexity here is starting to be
 * huge, it is better if I'll use this as experiment for 
 * language-dependned analysis and extraction */

function text(xx) {
    debug("implement text");
    return xx;
}

/*
var commentsR = [ /Comments$/, /Comentarios$/, /Commenti$/, /Comentári$/, /Comentários$/, /Reacties$/, /Kommentare$/, /Commentaires$/ ];
var translation = [ /Visualizza traduzione$/ ];

function mapReduceTrim(reglist, stext, init) {
    return _.reduce(reglist, function(memo, regex) {
        if( !stext || !_.size(stext) )
            return memo;
        if(memo !== init)
            return memo;
        var c = stext.replace(regex, '');
        if(_.size(c) !== _.size(stext))
            return c;
        return memo;
    }, init);
}

function getText(snippet) {

    var $ = cheerio.load(snippet.html);
    var retO = { 'feedText': false };

    try {
        var s = $('.userContent');
        var extractedT = s.text();
        var rt = mapReduceTrim(translation, extractedT, extractedT);
    } catch(err) { }

    var h5 = $('h5');
    var cinque = h5.text();
    var h6 = $('h6');
    var sei = h6.text();
    var source, reason;

    source = mapReduceTrim(commentsR, sei, sei);
    if(!source || source == "")
        source = mapReduceTrim(commentsR, cinque, cinque);
    else
        reason = cinque;


    if(_.size(source)) {

        var debt = "[" + source + "]";

        retO.feedText = true;

        _.extend(retO, { source: source });

        if(_.size(rt)) {
            _.extend(retO, { text: rt });
            debt += " ε " + _.size(rt);
        }

        if(_.size(reason)) {
            _.extend(retO, { reason: reason });
            debt += " [" + reason + "]";
        }

        debug("𝛶 %s %s", snippet.id, debt);
        return retO;

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

*/

module.exports = text; 
