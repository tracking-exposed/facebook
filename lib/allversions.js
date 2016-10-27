
var _ = require('lodash');

var implementations = {
    version1: {
        /* POST from the userscript */
        processEvents:    require('./events').processEvents,
        authMiddleWare:   require('./events').authMiddleWare,

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
