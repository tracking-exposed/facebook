module.exports = {
    /* this sequence is executed in this order.
     * after the newline there are modules that levegared on previously mined metadata */
    dissectorList: [
        'textChains',
        'hrefChains',
        'imageChains',
        'interactions',
        'profiles',

        'attributions',
        'meaningfulId',
/*
        'data-ad-preview',
        'usertext',
        'video',
        'commentable',
        'external',
        'opengraph',
        'event', */
    ],
    textChains: require('./textchains'),
    hrefChains: require('./hrefchains'),
    imageChains: require('./imageChains'),
    interactions: require('./interactions'),
    profiles: require('./profiles'),

    attributions: require('./attributions'),
    meaningfulId: require('./meaningfulId'),

    'data-ad-preview': require('./data-ad-preview'),
    usertext: require('./usertext'),
    commentable: require('./commentable'),
    external: require('./external'),
    event: require('./event'),
    // regexp: require('../regexp'),
    opengraph: require('./opengraph'),
    video: require('./video'),
};

/*
const pipeline = require('./index');
const findOutNature = require('../nature');
const semantic = require('../semantic');
function mandatoryPostId(envelop) {
    var p = _.get(envelop, 'feed_id.postId');
    if(!p)
        p = _.get(envelop, 'linkontime.postId');
    return p;
};
function sequence(envelop) {
    debug("🡆🡆  http://localhost:1313/debug/html/#%s", envelop.impression.id);
    ];
    envelop.errors = [];
    envelop = _.reduce(flist, function(memo, fname) {
        try {
            let result = pipeline[fname](memo);
            if(result)
                _.set(memo, fname, result);
            return memo;
        } catch(error) {
            debug("at %s: error catch <%s>", fname, error.message);
            debug(error.stack);
            memo.errors.push({
                step: fname,
                error: error.message            
            });
        } finally {
            return memo;
        }
    }, envelop);

    envelop.postId = mandatoryPostId(envelop); // mandatory for the postIdCount
    envelop.fullText = semantic.fullText(envelop); // for the semanticCount & semanticId
    envelop.fullTextSize = _.size(envelop.fullText);
    envelop.nature = findOutNature(envelop);

    /* this returns only the metadata. possible extension of the metadata
     * structure it is possibile, or possible recomputation of specific
     * components too. Just at the moment the mongo functions calling this don't even
     * support or care of the possibility 
    return envelop;
};
*/
