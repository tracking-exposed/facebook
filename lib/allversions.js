
var _ = require('lodash');

var apiListVersion1 = {

    /* informative GET */
    nodeInfo:         require('./version1').nodeInfo,
    nodeExport:       require('./version1').nodeExport,
    getRefreshMap:    require('./version1').getRefreshMap,
    userAnalysis:     require('./version1').userAnalysis,
    countriesStats:   require('./version1').countriesStats,

    /* personal page */
    getTimelines:     require('./personal').getTimelines,
    getMetadata:      require('./personal').getMetadata,
    dietBasic:        require('./personal').dietBasic,

    /* call by /impact */
    getStats:         require('./stats').getStats,
    getEngagement:    require('./stats').getEngagement,

    /* ß query capability */
    queryContent:     require('./opendata').queryContent,
    metaxpt:          require('./opendata').metaxpt,

    /* not API, serving static pages from sections/*.pug */
    getImpact:        require('./staticpages').getImpact,
    getPage:          require('./staticpages').getPage,

    /* RealityMeter */
    getTopPosts:      require('./realitymeter').getTopPosts,
    postReality:      require('./realitymeter').postReality,

    /* HTML units */
    unitById:         require('./htmlunit').unitById,

    /* RealityCheck */
    metadataByTime:   require('./personal').mtByTime,
    metadataByAmount: require('./personal').mtByAmount,
    personalCSV:      require('./personal').csv,
    personalProfile:  require('./personal').profile,
    metadataLegacy:   require('./personal').legacy,

    /* alarms */
    getAlarms:        require('./version1').getAlarms,

    /* reducers */
    reducer1:         require('./reducer1'),

    /* researcher interfaces */
    distinct:         require('./research').distinct,
    rstats:           require('./research').rstats,
    rdata:            require('./research').rdata,
    researcher:       require('./research').researcher,

    /* qualitative* */
    qualitativeGet:   require('./research').qualitativeGet,
    qualitativeUpdate:require('./research').qualitativeUpdate,
    qualitativeOverview: require('./research').qualitativeOverview,

    /* exported for the new backend */
    exportText:       require('./integration').exportText,

    /* integration to support the development of the new parsers */
    glue:             require('./glue')
};

module.exports = {
    implementations: apiListVersion1
};
