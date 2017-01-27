
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
    postReality:      require('./version1').postReality,
    postLife:         require('./version1').postLife,
    userTimeLine:     require('./version1').userTimeLine,
    userAnalysis:     require('./version1').userAnalysis,
    countriesStats:   require('./version1').countriesStats,

    /* personal page */
    getTimelines :    require('./personal').getTimelines,
    getMetadata:      require('./personal').getMetadata,

    /* byDay analysis */
    byDayStats:       require('./daily').byDayStats,

    /* admin POST */
    manualBoarding:   require('./version1').manualBoarding,

    /* ß query capability */
    queryContent:     require('./opendata').queryContent,

    /* not API, serving static pages from sections/*.jade */
    getImpact:        require('./staticpages').getImpact,
    getRealityCheck:  require('./staticpages').getRealityCheck,
    getRandom:        require('./staticpages').getRandom,
    getPage:          require('./staticpages').getPage,
    getRealityMeter:  require('./staticpages').getRealityMeter,

    /* HTML units */
    unitByCoordinates:require('./htmlunit').unitByCoordinates,
    unitByDays:       require('./htmlunit').unitByDays,
    unitById:         require('./htmlunit').unitById,

    /* new realitycheck page */
    personalContribution:   require('./personal').contribution,
    personalPromoted:       require('./personal').promoted,
    personalHeatmap:        require('./personal').heatmap
};

module.exports = {
    implementations: apiListVersion1
};
