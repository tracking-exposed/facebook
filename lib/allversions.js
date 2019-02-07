
var _ = require('lodash');

var apiListVersion1 = {

    /* ß query capability */
    queryContent:     require('./opendata').queryContent,

    /* not API, serving static pages from sections/*.pug */
    getImpact:        require('./staticpages').getImpact,
    getPage:          require('./staticpages').getPage,
    /* HTML units */

    /* - summary - new approach */
    getSummaryPage:   require('./summary').page,
    getSummaryData:   require('./summary').data,
    getMetadataData:  require('./summary').metadata,
    getSummaryCSV:    require('./summary').csv,

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

    /* integration to support the development of the new parsers */
    glue:             require('./glue')
};

module.exports = {
    implementations: apiListVersion1
};
