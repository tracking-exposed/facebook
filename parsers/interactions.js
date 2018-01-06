#!/usr/bin/env nodejs
var _ = require('lodash');
var cheerio = require('cheerio');
var moment = require('moment');
var debug = require('debug')('interactions');
var parse = require('./lib/parse');
var nconf = require('nconf');

nconf.argv()
     .env()
     .file('users', { file: "config/users.json" });

var stats = { processed: 0, success: 0, failure: 0, bugs: {} };

function extendStats(label) {

    var words = label.replace(/\ /g, ':').replace(/[0-9]/g, '').split(':');
    _.each(_.compact(words), function(w) {
        if( (w[0] >= '0') && (w[0] <= '9'))
            return;

        if(_.isUndefined(stats.bags[w]))
            stats.bags[w] = 1;
        else
            stats.bags[w] += 1;
    });
}

function getInteractions(snippet) {

    if(!(_.reduce( nconf.get('wto'), function(memo, u) {
        memo |= ( _.parseInt(u.id) === snippet.userId);
        return memo;
    }, false)))
        return { interactions: false };

    var $ = cheerio.load(snippet.html);

    if(!stats.processed)
        debug("process begin with ID %s %s", snippet.id, snippet.savingTime);

    stats.processed +=1;

    try {
        var reactions = $('[ajaxify^="/ufi/reaction/"]');
        // if(!_.size(reactions)) { debug("please investigate in 0 reaction %s", snippet.id); };

        var reactionmap = _.reduce(reactions, function(memo, r) {
            var l = $(r).attr('ajaxify').split('&');
            _.each(l, function(seg) {
                if(_.startsWith(seg, "reaction_")) {

                    var label = $(r).attr('aria-label');

                    if(_.size(label.split(':')) === 2)
                        var amountStr = label.split(':')[1];
                    else if(_.size(label.split(' ')) >= 2)
                        var amountStr = label.split(' ')[0];
                    else
                        var amountStr = null;

                    var statsNeeded = true;
                    if(amountStr.match(/[Kk]/)) {
                        var commadot = !!amountStr.match(/[,.]/);
                        var i = _.parseInt(amountStr.replace(/[.,Kk]/g, ''));
                        var amount = commadot ? (i * 100) : (i * 1000);
                        // debug("E, commadot %s\ti %d\tamount %d\t[%s]", commadot, i, amount, amountStr);
                        statsNeeded = false;
                    } else if(amountStr.match(/mil/)) {
                        var commadot = !!amountStr.match(/[,.]/);
                        var i = _.parseInt(amountStr.replace(/[.,mil]/g, ''));
                        var amount = commadot ? (i * 100) : (i * 1000);
                        // debug("S, commadot %s\ti %d\tamount %d\t(%s)", commadot, i, amount, amountStr);
                        statsNeeded = false;
                    } else {
                        var amount = _.parseInt(amountStr);
                    }

                    if(amountStr.match(/!\d/) && statsNeeded) {
                        /* collect the words appearing in 'label' */
                        extendStats(label);
                    }

                    var reactionType  = seg.split('=');
                    memo.push({
                        label: label,
                        type: _.parseInt(reactionType[1]),
                        amount: amount
                    });

                }
            });
            return memo;
        }, []);

        var rcount = _.reduce(reactionmap, function(memo, desc) {
            memo += desc.amount;
            return memo;
        }, 0);

        if(_.reduce(reactionmap, function(ret, o) {
            ret = ret | _.isNull(o.amount);
            return ret;
        }, false)) {
            debug("Spot %d reactions type %d total, %s",
                _.size(reactionmap), rcount,
                JSON.stringify(reactionmap, undefined, 2));
        }

        /* polities are the polite writings for comments & shares */
        var polites = $('[aria-live="polite"]');
        /* shares and comments counting */
        var sn = 0, cn = 0;

        if(_.size(polites) >= 1) {

            _.times(polites.length, function(i) {
                /* remember: this is Cheerio! */
                var p = _.get(polites, String(i));

                if( !! $(p).attr('href')) {

                    var politehref = $(p).attr('href');
                    var politelabel = $(p).text();
                    var value = _.parseInt(politelabel.replace(/[a-zA-Z:.,]/g, ''));

                    if( politelabel.match(/[Kk]/) || politelabel.match(/mil/) ) {
                        var commadot = !!politelabel.match(/[,.]/);
                        value = commadot ? (value * 100) : (value * 1000);
                    }
                    if(politehref.match(/shares\//))
                        sn = value;
                    if(politehref.match(/comment/))
                        cn = value;

                    // debug("[%s], shares %d comments %d", politelabel, sn, cn);
                }
            });
        };

        stats.success +=1;
        var retv = {
            interactions: true,
            rmap: reactionmap,
            rtotal: rcount,
            shares: sn,
            comments: cn
        };
        debug("%s %s",
            moment.duration(moment(snippet.savingTime)).humanize(),
            JSON.stringify(retv));

        return retv;

    } catch(err) {
        debug("øø unable to get reaction in %s: %s", snippet.id, err);
        stats.failure +=1;
        return { interactions: false };
    }
};

var postInteractions = {
    'name': 'interactions',
    'requirements': {},
    'implementation': getInteractions,
    'since': "2017-10-01",
    'until': moment().toISOString(),
};

return parse
    .please(postInteractions)
    .tap(function() {
        console.log("getInteractions complete: %s", JSON.stringify(stats, undefined, 2));
    });
