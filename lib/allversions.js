
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

    /* byDay analysis */
    byDayStats:       require('./daily').byDayStats,

    /* admin POST */
    manualBoarding:   require('./version1').manualBoarding,

    /* not API, serving static pages from sections/*.jade */
    getImpact:        require('./staticpages').getImpact,
    getRealityCheck:  require('./staticpages').getRealityCheck,
    getRandom:        require('./staticpages').getRandom,
    getPage:          require('./staticpages').getPage,
    getRealityMeter:  require('./staticpages').getRealityMeter

};

module.exports = {
    implementations: apiListVersion1
};
