
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
    countriesStats:   require('./version1').countriesStats,
    countryStatsByDay:require('./version1').countryStatsByDay,
    postReality:      require('./version1').postReality,
    postLife:         require('./version1').postLife,
    byDayActivity:    require('./version1').byDayActivity,
    userTimeLine:     require('./version1').userTimeLine,
    userAnalysis:     require('./version1').userAnalysis,

    /* admin POST */
    manualBoarding:   require('./version1').manualBoarding,

    /* not API, serving static pages from sections/*.jade */
    getImpact:        require('./staticpages').getImpact,
    getPersonal:      require('./staticpages').getPersonal,
    getRandom:        require('./staticpages').getRandom,
    getPage:          require('./staticpages').getPage,
    getRealityMeter:  require('./staticpages').getRealityMeter
};

module.exports = {
    implementations: apiListVersion1
};
