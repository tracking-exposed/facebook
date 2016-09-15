
var _ = require('lodash');

var implementations = {
    version2: {
        nodeInfo:         require('./version2').nodeInfo,
        nodeExport:       require('./version2').nodeExport,
        /* feed getOverseer: */
        nodeActivity:     require('./version2').nodeActivity,
        publicTopPosts:   require('./version2').publicTopPosts,
        publicPostReality:require('./version2').publicPostReality,
        publicPostLife:   require('./version2').publicPostLife,
        /* feed getPersonal: */
        userTimeLine:     require('./version2').userTimeLine,
        userStats:        require('./version2').userStats,
        postFeed:         require('./version2').postFeed,
        postDebug:        require('./version2').postDebug,
        writeContrib:     require('./version2').writeContrib,
        getIndex:         require('./staticpages').getIndex,
        getImpact:        require('./staticpages').getImpact,
        getPersonal:      require('./staticpages').getPersonal,
        getOverseer:      require('./staticpages').getOverseer,
        getPage:          require('./staticpages').getPage,
        getRealityMeter:  require('./staticpages').getRealityMeter
    },
    /* still not implemented */
    version3: {
        // serveCustomUserScript: require('./version2').serveCustomUserScript
    }
};

module.exports = {
    lastVersion: 2,
    implementations: implementations
};
