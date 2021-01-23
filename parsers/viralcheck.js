const _ = require('lodash');
const debug = require('debug')('parsers:viralcheck');

function viralcheck(envelop, previous) {

    const test1 = {
      en: /Suggested for [Yy]ou/,
      it: /Suggerita per te/,
    }

    const viral = _.compact(_.map(test1, function(rexp, twolc) {
        // let r = envelop.html.html.match(rexp);

        // this pick the first textual node
        let firstn = envelop.jsdom.querySelector('span[dir="auto"]');
        // check if any of the regexp matches. there are more version from each language
        let r = firstn.textContent.match(rexp);
        // check the position in html of the first node.
        let relative = envelop.html.html.indexOf(firstn.outerHTML);

        //console.log(firstn.textContent, twolc, relative, r, !r);
        return (r) ? {
          cc: twolc,
          relative,
          generated: firstn.textContent,
          match: r,
          success: true,
        } : null;
    }));

    if(viral.length) {
      debug("Spotted viral %j\t%d, lang %s", viral[0].match, viral[0].relative, viral[0].cc);
    }

    let explorative, explorelative;
    if(!viral.length) {
        explorative = envelop.jsdom.querySelector('span[dir="auto"]');
        explorelative = envelop.html.html.indexOf(explorative.outerHTML);
        // the 1000 value comes by observing the 'relative' variable above
        if(explorative < 1000) {
          debug("Explorative \t %d \t %s", explorelative, "\t", explorative.textContent);
        }
    }

    return viral.length ? viral[0] : { explorative, explorelative, success:false };
};

module.exports = viralcheck;
