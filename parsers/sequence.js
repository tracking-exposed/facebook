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
    video: require('./video'),
};