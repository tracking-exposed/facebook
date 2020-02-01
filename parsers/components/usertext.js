var _ = require('lodash');
var debug = require('debug')('parsers:components:usertext');
var helper = require('./utils/helper');

function usertext(envelop) {

    const uc = envelop.jsdom.querySelectorAll('.userContent');
    /* 'p' element can be nested like:
     * <div class="userContent"><div class="text_exposed_root"><p>Dear Room sea..., additionally
     * as long as we have HTML information, this function keep track of offsets */
    let paragraphs = _.flatten(_.map(uc, function(node, i) {
        let ps = node.querySelectorAll('p');
        let blockffset = envelop.impression.html.indexOf(node.outerHTML);
        return _.map(ps, function(p) {
            return {
                p: p,
                blockffset
            };
        });
    }));

    const P = envelop.jsdom.querySelectorAll('p');
    /* in rare case like 1fe9b6c4a228f0c85ef7e5e18111e3bca8d54b72 'p' are left alone */
    if(_.size(P) && !_.size(paragraphs)) {
        paragraphs = _.map(P, function(node, i) {
            let blockffset = envelop.impression.html.indexOf(node.outerHTML);
            return {
                p: node,
                blockffset
            };
        });
    }

    /* for each of these elements look at the content, and return an object of three types:
     * - text
     * - hashtag
     * - external
     * - internal (when a page or an user is linked)
     * - event 
     */
    const minedtexts = _.reduce(paragraphs, function(memo, e) {

        let text = e.p.textContent;
        let links = e.p.querySelectorAll('a');

        if(links.length) {
            /* append in 'memo' as side effect of _.each */
            _.each(links, function(a) {
                let linkedT = a.textContent;
                let href = a.getAttribute('href');
                if(_.startsWith(href, '/hashtag/')) {
                    let mined = {
                        blockffset: e.blockffset,
                        type: 'hashtag',
                        text: linkedT
                    };
                    memo.push(mined);
                } else if(_.startsWith(href, 'https://www.facebook.com')) {
                    let mined = {
                        blockffset: e.blockffset,
                        type: 'internal',
                        text: linkedT,
                        link: helper.stripURLqs(href)
                    };
                    memo.push(mined);
                } else if(_.startsWith(href, 'https://l.facebook.com')) {
                    let legacy = helper.facebookLink(href);
                    // TODO find a new stable format, the one in this file is better than the helper
                    //  fblinktype: 'external',  link: 'https://cnn.it/2CkV8j0',     isValid: true }
                    let mined = {
                        blockffset: e.blockffset,
                        type: 'external',
                        text: linkedT,
                        link: legacy.link
                    };
                    memo.push(mined);
                } else if(_.startsWith(href, 'http')) {
                    /* this is an indicator of advertising */
                    helper.indicator(envelop, 'cleanLink', href);
                    let mined = {
                        blockffset: e.blockffset,
                        type: 'external',
                        link: href
                    }
                } else if(_.startsWith(href, '/')) {
                    let mined = helper.fbRelativeSplit(href);
                    mined.blockffset = e.blockffset;
                    mined.type = 'internal';
                    mined.link = helper.stripURLqs(href);
                } else {
                    debug("Unsupported kind: %s", href);
                    debugger;
                }
            });
        }

        if(_.size(text)) {
            let mined = {
                blockffset: e.blockffset,
                type: 'text',
                text,
                len: _.size(text)
            };
            memo.push(mined);
        }
        return memo;
    }, []);

    if(_.size(minedtexts))
        debug("mined %d texts: %j",
            _.size(minedtexts),
            _.countBy(minedtexts, 'type'));

    return minedtexts;
};

module.exports = usertext;
