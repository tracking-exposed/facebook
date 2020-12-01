const _ = require('lodash');
const debug = require('debug')('parsers:utils:helper');
const querystring = require('querystring');

const utils = require('../lib/utils');

function getOffset(htmltext, node) {
    const fo = htmltext.indexOf(node.outerHTML);
    const check = _.split(htmltext.indexOf, node.outerHTML);
    if(_.size(check) > 2)
        debug("Warning! getOffset returns %d but the matching pieces are more than 1!!", fo);
    return fo;
}

function updateHrefUnit(unit, sourceKey) {
    let thref = _.get(unit, sourceKey);
    if(_.startsWith(thref, '/'))
        _.set(unit, sourceKey, 'https://www.facebook.com' + thref );
    const bang = _.startsWith(thref, '#');
    try {
        if(!bang) {
            unit.URLo = new URL(_.get(unit, sourceKey));
            unit.parsed = querystring.parse(unit.URLo.search);
            unit.urlId = utils.hash({ parsedURL: unit.URLo.toString()})
        }
    } catch(e) {
        debug("Unexpected error in URL parsing %s: %s", thref, e.message);
        throw e;
    }
    return unit;
}

function recursiveSize(e, memo) {
    const elementSize = _.size(e.outerHTML);
    const tagName = e.tagName;
    if(!tagName)
        return memo;
    const combo = elementSize + ''; // + '-' + tagName.substring(0, 5);
    if(!memo)
        return recursiveSize(e.parentNode, [ combo ]);
    memo.push(combo);
    return recursiveSize(e.parentNode, memo);
}
function sizeTreeResearch(e) {
    let sizes = [];
    sizes.push(recursiveSize(e));
}

function nextNode(node) {
    let r = node.parentNode;
    if(!r) throw new Error("Recursion fail");
    return r;
};
function recursiveQuery(startingNode, tagName) {
    let node = startingNode;
    try {
        while(node.tagName != _.toUpper(tagName) )
            node = nextNode(node);
    } catch(e) {
        debug("E: %s", e.message);
    }
    if(node.tagName != tagName)
        return null;
    debug("find! %s", node.tagName);
    return node;
}

function recursiveText(startNode) {
    let node = startNode;
    try {
        while( _.size(node.textContent) === 0) {
            node = nextNode(node);
            /* if((node.children.length) > 1) {
                debug("%j", _.map(node.children,function(n){ return n.tagName, n.textContent }));
            } */
        }
    } catch(e) {
        debug("%E: %s", e.message);
    }
    return _.first(node.textContent.split('·')).trim();
}

module.exports = {
    getOffset,
    updateHrefUnit,
    sizeTreeResearch,
    recursiveSize,
    recursiveQuery,
    recursiveText,
};