
var _ = require('lodash');

var apiListVersion1 = {
    /* POST from the userscript */
    processEvents:    require('./events').processEvents,
    validateKey:      require('./onboarding').validateKey,

    /* POST on parser operations */
    snippetAvailable: require('./parser').snippetAvailable,
    snippetContent:   require('./parser').snippetContent,
    snippetResult:    require('./parser').snippetResult,

    /* informative GET */
    nodeInfo:         require('./version1').nodeInfo,
    nodeExport:       require('./version1').nodeExport,
    getRefreshMap:    require('./version1').getRefreshMap,
    userAnalysis:     require('./version1').userAnalysis,
    countriesStats:   require('./version1').countriesStats,

    /* personal page */
    getTimelines :    require('./personal').getTimelines,
    getMetadata:      require('./personal').getMetadata,

    /* call by /impact */
    getStats:         require('./stats').getStats,
    getEngagement:    require('./stats').getEngagement,

    /* ß query capability */
    queryContent:     require('./opendata').queryContent,
    metaxpt:          require('./opendata').metaxpt,

    /* not API, serving static pages from sections/*.pug */
    getImpact:        require('./staticpages').getImpact,
    getPage:          require('./staticpages').getPage,

    /* RealityMeter */
    getTopPosts:      require('./realitymeter').getTopPosts,
    postReality:      require('./realitymeter').postReality,

    /* HTML units */
    unitById:         require('./htmlunit').unitById,

    /* RealityCheck */
    metadataByTime:   require('./personal').mtByTime,
    metadataByAmount: require('./personal').mtByAmount,
    personalCSV:      require('./personal').csv,
    personalProfile:  require('./personal').profile,

    /* alarms */
    getAlarms:        require('./version1').getAlarms,

    /* selector fetch experiment */
    getSelector:      require('./selector').getSelector,

    /* reducers */
    reducer1:         require('./reducer1')
};

module.exports = {
    implementations: apiListVersion1
};
