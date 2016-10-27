
var _ = require('lodash');

var implementations = {
    version1: {
        nodeInfo:         require('./version1').nodeInfo,
        nodeExport:       require('./version1').nodeExport,
        countriesStats:   require('./version1').countriesStats,
        countryStatsByDay:require('./version1').countryStatsByDay,
        /* feed realitymeter : */
        postReality:      require('./version1').postReality,
        /* not used ATM */
        postLife:         require('./version1').postLife,
        /* used in getImpact and getPersonal */
        byDayActivity:    require('./version1').byDayActivity,
        /* feed getPersonal: */
        userTimeLine:     require('./version1').userTimeLine,
        userAnalysis:     require('./version1').userAnalysis,
        /* from the userscript */
        processEvents:    require('./version1').processEvents,
        /* not API, serving static pages from sections/*.jade */
        getImpact:        require('./staticpages').getImpact,
        getPersonal:      require('./staticpages').getPersonal,
        getRandom:        require('./staticpages').getRandom,
        getPage:          require('./staticpages').getPage,
        getRealityMeter:  require('./staticpages').getRealityMeter
    },
    /* still not implemented */
    version2: {
        // serveCustomUserScript: require('./version2').serveCustomUserScript
    }
};

module.exports = {
    lastVersion: 1,
    implementations: implementations
};
