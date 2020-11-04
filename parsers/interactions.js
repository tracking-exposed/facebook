const _ = require('lodash');
const debug = require('debug')('parsers:components:interactions');
const querystring = require('querystring');
const helper = require('./helper');

const unitMap = {
    "K": 1000,
    "k": 1000,
    "d.": 1000,
    "mil": 1000,
    "Mila": 1000,
    "tys.": 1000,
};

function unitParse(envelop, mult) {

    /* if there is '.' or ',' multiply by 100 */
    const commadot = !!mult.match(/[,.]/);
    const commaless = mult.replace(/[.,]/, '');
    const convertedSize = _.size(_.parseInt(commaless) + "");

    const lookfor = _.reduce(_.reverse(_.times(_.size(mult))), function(memo, i) {
        if(memo.found)
            return memo;
        let rightchar = mult.charAt(i);
        memo.acc = rightchar + memo.acc;
        if(_.keys(unitMap).indexOf(memo.acc) != -1)
            memo.found = true;
        return memo;
    }, { found: false, acc: "" });

    let factor = 1;

    if(lookfor.found)
        factor = _.get(unitMap, lookfor.acc, null);

    if(commadot && factor == 1 && convertedSize != _.size(commaless)) {
        envelop.errors.push({ 'interactions': mult });
        debug("Unsupported measurement unit in [%s]", mult);
    }

    let amount = _.parseInt(commaless) * factor;
    if(commadot && factor != 1)
        amount = amount / 10;

    return amount;
};

function interactions(envelop) {

    const reactions = envelop.jsdom.querySelectorAll('[ajaxify^="/ufi/reaction/"]');
    if(!reactions) {
        debug("This post has not reaction of any kind?");
        return null;
    }

    const rawmap = _.reduce(reactions, function(memo, elem) {

        const desc = elem.getAttribute('aria-label');
        if(!desc)
            return memo;
        if(!desc.match(/^[0-9]/))
            return memo;

        const check = _.split(desc, ' ');

        if(_.size(check) > 2) {
            debug("Strange condition to report, more than one space? [%j]", check);
            helper.notes(envelop, 'interactions', { input: desc });
        }

        const ajaxurl = elem.getAttribute('ajaxify');
        const decoded = querystring.parse(decodeURIComponent(ajaxurl));

        /* this parses '1K' to 1000 and return integer */
        amount = unitParse(envelop, check[0]);

        if(!amount)
            debugger;

        memo.push({
            amount,
            desc,
            rtype: decoded.reaction_type
        });
        return memo;
    }, []);

    debug("Out of %d entries, found %d reactions", reactions.length, _.size(rawmap) );

    return rawmap;
};

module.exports = interactions;



/*
                    if(politehref.match(/shares\//))
                        sn = value;
                    if(politehref.match(/comment/))
                        cn = value;

                        */
