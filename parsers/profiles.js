const _ = require('lodash');
const debug = require('debug')('parsers:profiles');
const helper = require('./helper');


function profiles(envelop, previous) {
    const imagenodes = envelop.jsdom.querySelectorAll('image');
    const profiles = _.compact(_.map(imagenodes, function(ino) {

        const retval = {
            style: ino.getAttribute('style')
        }

        if(retval.style != "height: 40px; width: 40px;")
            return null;
        
        retval.href = ino.getAttribute('xlink:href');

        if(retval.height && retval.width)
            retval.dimension = [ _.parseInt(retval.width), _.parseInt(retval.height) ];

        retval.recursive = helper.sizeTreeResearch(ino);
        const firstParentA = helper.recursiveQuery(ino, 'a');

        if(firstParentA) {
            retval.parentHref = firstParentA.getAttribute('href');
            retval.aria = firstParentA.getAttribute('aria-label');
            helper.updateHrefUnit(retval, 'parentHref');
        }
        helper.updateHrefUnit(retval, 'href');
        return retval;
    }));

    return { profiles };
}

module.exports = profiles;