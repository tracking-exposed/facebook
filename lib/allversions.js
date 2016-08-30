
var _ = require('lodash');

var implementations = {
    version2: {
        adminStats:       require('./version2').adminStats,
        /* feed getOverseer: */
        adminDataView:    require('./version2').adminDataView,
        publicStats:      require('./version2').publicStats,
        publicTopPosts:   require('./version2').publicTopPosts,
        /* feed getPersonal: */
        userTimeLine:     require('./version2').userTimeLine,
        userTimeLineCSV:  require('./version2').userTimeLineCSV,
        userStats:        require('./version2').userStats,
        exportNode:       require('./version2').exportNode,
        postFeed:         require('./version2').postFeed,
        writeContrib:     require('./version2').writeContrib,
        getIndex:         require('./staticpages').getIndex,
        getPersonal:      require('./staticpages').getPersonal,
        getOverseer:      require('./staticpages').getOverseer,
        getPresentation:  require('./staticpages').getPresentation,
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
