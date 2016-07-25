
var _ = require('lodash');

var implementations = {
    version1: {
        postFeed:         require('./version1').postFeed,
        getIndex:         require('./version1').getIndex,
    },
    version2: {
        adminStats:       require('./version2').adminStats,
        adminTokenCheck:  require('./version2').adminTokenCheck,
        publicStats:      require('./version2').publicStats,
        postFeed:         require('./version2').postFeed,
        getToken:         require('./version2').getToken,
        userPublicPage:   require('./version2').userPublicPage,
        userPrivateView:  require('./version2').userPrivateView,
        exportNode:       require('./version2').exportNode,
        getIndex:         require('./version1').getIndex,
        writeContrib:     require('./version2').writeContrib
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
