
var _ = require('lodash');

var implementations = {
    version2: {
        nodeInfo:         require('./version2').nodeInfo,
        nodeExport:       require('./version2').nodeExport,
        countriesStats:   require('./version2').countriesStats,
        countryStatsByDay:require('./version2').countryStatsByDay,
        /* feed realitymeter : */
        postReality:      require('./version2').postReality,
        /* not used ATM */
        postLife:         require('./version2').postLife,
        /* used in getImpact and getPersonal */
        byDayActivity:    require('./version2').byDayActivity,
        /* feed getPersonal: */
        userTimeLine:     require('./version2').userTimeLine,
        userAnalysis:     require('./version2').userAnalysis,
        /* from the userscript */
        postFeed:         require('./version2').postFeed,
        postDebug:        require('./version2').postDebug,
        /* not API, serving static pages from sections/*.jade */
        getIndex:         require('./staticpages').getIndex,
        getTeam:          require('./staticpages').getTeam,
        getImpact:        require('./staticpages').getImpact,
        getPersonal:      require('./staticpages').getPersonal,
        getRandom:        require('./staticpages').getRandom,
        getPage:          require('./staticpages').getPage,
        getRealityMeter:  require('./staticpages').getRealityMeter
    },
    /* still not implemented */
    version3: {
        // serveCustomUserScript: require('./version3').serveCustomUserScript
    }
};

module.exports = {
    lastVersion: 2,
    implementations: implementations
};
