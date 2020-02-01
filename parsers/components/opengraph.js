var _ = require('lodash');
var debug = require('debug')('parsers:components:opengraph');
var helper = require('./utils/helper');

function authoredOpenGraph(envelop, mined, ref) {
    // in this special case, use external and don't use the standard recursive function */
    helper.notes(envelop, 'authoredOpenGraph', { mined });
    if(_.size(envelop.external) != 1) {
        // if is 0, manage an error, if is > 1, I don't know if use the last or the first 
        debugger;
        throw new Error("unsupported condition");
    } 
  
    if(envelop.external[0].isValid != true)
        throw new Error("missing requirement");

    mined.link = envelop.external[0].link;
    mined.siteName = ref.parentNode.textContent.replace(/\|.*/, '');
    mined.title = envelop.external[0].linked;
    mined.description = ''; // this is ignored, despite accessible from ref.parentNode.parentNode

    return mined;
};

function recursiveTextContent(memo, node) {

    if(node.children.length) {
        return _.reduce(node.children, recursiveTextContent, memo);
    } else {
        memo.push(node.textContent);
        return memo;
    }
};

function usertext(envelop) {

    const ellipsis = envelop.jsdom.querySelectorAll('.ellipsis');

    if(_.size(ellipsis) > 1) {
        debug("warning! more than one .ellipsis?");
    } else if(!_.size(ellipsis) )
        return null;

    let ref = ellipsis[0];
    do {
        ref = ref.parentNode;
    } while(ref.outerHTML.length < 1000);

    /* at the moment is ignored the attached image, only the text is considered,
     * 6310b57981108091a1aaa2b33cf73eb537ffde54 */

    const link = ref.querySelector('a').getAttribute('href');
    let mined;

    if(helper.isFacebookLink(link))
        mined = helper.facebookLink(ref.querySelector('a').getAttribute('href'));
    else {
        mined = {
           fblinktype: 'external',
           link,
           isValid: _.startsWith(link, 'http')
        }
    }

    // If is a facebook.com internal link, has a permaLink and not a link
    // this happen when an author is linked by facebook OG 9a15a5af3c6ef130c7f14cedfce4260d2067bb52
    // and the chain-method used in the do/while above doesn't fit, in cases like this
    // the size become circa 2000 bytes. That's why I forcefully merge the external
    // link with this. The recursive approach doesn't work, so it is managed in a different logic
    if(!mined.link && mined.permaLink)
        return authoredOpenGraph(envelop, mined, ref);

    /* cleaning parameters because we don't want to spread trackers, but might they be necessary? XXX */
    mined.link = helper.stripURLqs(mined.link);

    /* to find out description, instead of takin an unstable map such as:
          mined.siteName = ref.children[0].textContent;
          mined.title = ref.querySelector('a').textContent;
          mined.description = ref.children[1].children[0].textContent;
          or 81efbb4ba04dc9e50dd3cd352af33b5d0c4997f2:
          mined.description = ref.children[0].children[1].children[0].textContent
       a recursive child tree goes deep as possible until found a textContent, and
       they are attributed in order (the first is siteName, then title...
     */

    let texts = _.reduce(ref.children, recursiveTextContent, []);
    texts = _.filter(texts, _.size);

    _.each(['siteName', 'title', 'description'], function(target, i) {
        if(_.nth(texts, i))
            _.set(mined, target, _.nth(texts, i));
    });

    // debug("extracted info: %j", mined);
    return mined;
};

module.exports = usertext;
