var _ = require('lodash');
var debug = require('debug')('parsers:components:images');

function imageChains(envelop) {
    /* alt, the altenative text used in pictures, might contain the individual name of an user
     * from their picture profile. This selector might take that too. That is not an information
     * we should collect */

    const images = _.map(envelop.jsdom.querySelectorAll('image'), function(anode) {
        const src = anode.getAttribute('src');
        const retval = {};

        retval.src = src;
        retval.role = anode.getAttribute('role');
        retval.parent = anode.parentNode.tagName;
        retval.parentRole = anode.parentNode.getAttribute('role');
        retval.parentLabel = anode.parentNode.getAttribute('aria-label');

        const height = anode.getAttribute('height');
        const width = anode.getAttribute('width');
        if(height && width)
            retval.dimension = [ _.parseInt(width), _.parseInt(height) ];

        try {
            const Uo = new URL(src);
            retval.URL = Uo;
            // to get SVG decodeURIComponent(Uo.pathname)
        } catch(e) {}

        return retval;
    });

    debugger;
    return {
       images 
    };

    const ret = {
        alt: [],
        others: 0,
        profile: 0,
        profiles: [],
        unmatched: 0,
        imageUrls: [],
    };

    // b2a0b8a828e108d7b7c7792c52dae0bf58435abd 964d1d520f37ce79aa4e46122382c21a30e06565
    // 9d45d080da1b3afe39e4631b1bc466af12dbc122 9577ab3c75bc19b752fb73d1f841c7ca29673c2f
    _.each(envelop.jsdom.querySelectorAll('img'), function(e) {
        let src = e.getAttribute('src');
        let match = false;
        let consider = _.reduce( src.split('/'), function(memo, urlpiece) {
            if(_.startsWith(urlpiece, 'p')) {
                match = true;
                xy = urlpiece.replace(/^p/, '').split('x');
                x = _.parseInt(xy[0]);
                y = _.parseInt(xy[1]);

                if(x &&  _.round(x / y, 1) == 1) {
                    ret.profiles.push(src);
                    let debugalt = e.getAttribute('alt');
                    if(_.size(debugalt) > 0)
                        debug("¹ skipping %s because individual", debugalt);
                    ret.profile++;
                }
                else if(x && y) {
                    ret.imageUrls.push(src);
                    ret.others++;
                    memo = true;
                }
            }
            return memo;
        }, false);

        if(consider) {
            let alt = e.getAttribute('alt');
            if(_.size(alt))
                ret.alt.push(alt);
        }

        if(!match) {
            ret.imageUrls.push(src);
            ret.unmatched++;
        }
    });

    /* again, accumulate alt-text as side effects in ret.alt[] */
    _.each(envelop.jsdom.querySelectorAll('div > img'), function(i) {
        if(_.size(i.getAttribute('alt'))) {
            if( i.parentNode.getAttribute('role') === 'presentation' )
                debug("² skipping %s because individual", i.getAttribute('alt'));
            else
                ret.alt.push(i.getAttribute('alt'));
        }
    });

    // debug("images: %s", JSON.stringify(ret, undefined, 2));
    return ret;
};

module.exports = imageChains;
