
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

    /* admin POST */
    manualBoarding:   require('./version1').manualBoarding,

    /* ß query capability */
    queryContent:     require('./opendata').queryContent,

    /* not API, serving static pages from sections/*.pug */
    getImpact:        require('./staticpages').getImpact,
    getPage:          require('./staticpages').getPage,

    /* getRealityCheck:  require('./staticpages').getRealityCheck */
    getTopPosts:        require('./realitymeter').getTopPosts,
    postReality:        require('./realitymeter').postReality,

    /* HTML units */
    unitByCoordinates:  require('./htmlunit').unitByCoordinates,
    unitById:           require('./htmlunit').unitById,

    /* new realitycheck page */
    personalContribution:   require('./personal').contribution,
    personalPromoted:       require('./personal').promoted,
    personalHeatmap:        require('./personal').heatmap,
    personalHTMLs:          require('./personal').htmls,
    personalCSV:            require('./personal').csv,
    personalProfile:        require('./personal').profile,

    /* alarms */
    getAlarms:              require('./version1').getAlarms
};

module.exports = {
    implementations: apiListVersion1
};
