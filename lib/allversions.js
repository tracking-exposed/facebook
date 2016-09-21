
var _ = require('lodash');

var implementations = {
    version2: {
        nodeInfo:         require('./version2').nodeInfo,
        nodeExport:       require('./version2').nodeExport,
        /* feed getOverseer: */
        publicTopPosts:   require('./version2').publicTopPosts,
        publicPostReality:require('./version2').publicPostReality,
        publicPostLife:   require('./version2').publicPostLife,
        /* used in getImpact and getPersonal */
        byDayActivity:    require('./version2').byDayActivity,
        /* feed getPersonal: */
        userTimeLine:     require('./version2').userTimeLine,
        processedUserLog: require('./version2').processedUserLog,
        /* from the userscript */
        postFeed:         require('./version2').postFeed,
        postDebug:        require('./version2').postDebug,
        /* not API, serving static pages from sections/*.jade */
        getIndex:         require('./staticpages').getIndex,
        getImpact:        require('./staticpages').getImpact,
        getPersonal:      require('./staticpages').getPersonal,
        getOverseer:      require('./staticpages').getOverseer,
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
