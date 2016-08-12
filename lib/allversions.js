
var _ = require('lodash');

var implementations = {
    version1: {
        postFeed:         require('./version1').postFeed,
        getIndex:         require('./version1').getIndex,
        /* getPostInfo testing for version 1 */
        userTimeLine:     require('./version1').userTimeLine
    },
    version2: {
        adminStats:       require('./version2').adminStats,
        /* feed getOverseer: */
        adminDataView:    require('./version2').adminDataView,
        publicStats:      require('./version2').publicStats,
        /* feed getPersonal: */
        userTimeLine:     require('./version2').userTimeLine,
        exportNode:       require('./version2').exportNode,
        postFeed:         require('./version2').postFeed,
        writeContrib:     require('./version2').writeContrib,
        getIndex:         require('./version1').getIndex,
        getPersonal:      require('./version2').getPersonal,
        getOverseer:      require('./version2').getOverseer
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
