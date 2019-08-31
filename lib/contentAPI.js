module.exports = [
    /* debug, testing and monitoring API: ADMIN authenticated */
    {
        desc: "page navigator for parser debugging",
        route: '/api/v2/debug/:key/date/:savingTime',
        func: require('../routes/htmlunit').unitByDate,
    },
    {
        desc: "Testing tool, random timeline downloader",
        route: '/api/v2/debug/exporter/:key/:sample',
        func: require('../routes/exporter').exporter,
    },
    {
        desc: "Retrive the last 10 samples",
        route: '/api/v2/debug/sampler/:key',
        func: require('../routes/samplerdebug').samplerdebug
    },
    /* debug, testing and monitoring API: USER knowledge authenticated */
    {
        desc: "individual parser verification",
        route: '/api/v2/debug/html/:htmlId',
        func: require('../routes/htmlunit').unitById
    },
    {
        desc: "individual complete timeline verification",
        route: '/api/v2/debug/:timelineId',
        func: require('../routes/htmlunit').verifyTimeline
    },
    /* RSS feed */
    {
        desc: "fbtrexRSS Algorithm 0",
        route: '/feeds/0/:lang/:query',
        func: require('../routes/feeds').feedsAlgorithm0,
    },
    /* health check */
    {
        desc: "Health check",
        route: '/api/v2/health',
        func: require('../lib/common').health,
    },
    /* services status */
    {
        desc: "Service stats",
        route: '/api/v2/services',
        func: require('../routes/status').databaseStatus,
    },
    /* https://github.com/tracking-exposed/facebook/wiki/Personal-API-documentation */
    {
        desc: "Personal Summary",
        route: '/api/v2/personal/:userToken/summary/:paging?',
        func: require('../routes/personal').summary,
    },
    {
        desc: "Personal CSV",
        route: '/api/v2/personal/:userToken/csv/:paging?',
        func: require('../routes/personal').personalCSV,
    },
    {
        desc: "Personal Summary+Semantics",
        route: '/api/v2/personal/:userToken/semantics/:paging?',
        func: require('../routes/personal').semantics,
    },
    {
        desc: "Personal Daily Summary",
        route: '/api/v2/personal/:userToken/daily/:paging?',
        func: require('../routes/personal').daily,
    },
    {
        desc: "Personal Statistics",
        route: '/api/v2/personal/:userToken/stats/:paging?',
        func: require('../routes/personal').stats,
    },
    {
        desc: "Personal Data Exporter",
        route: '/api/v2/personal/:userToken/exporter/:paging?',
        func: require('../routes/exporter').personal,
    },
    {
        desc: "Personal Data Remove",
        route: '/api/v2/personal/:userToken/remove/:paging?',
        func: require('../routes/remove').remove,
    },
    /* Collective API
    {
        desc: "Collective stats",
        route: '/api/v2/collective/:groupLabel/stats/:dayrange?',
        func: require('./collective').stats,
    },
    {
        desc: "Collective summary",
        route: '/api/v2/collective/:groupLabel/download/:dayrange?',
        func: require('./collective').download,
    },
    */
    /* statistics, impact and measures */
    {
        desc: "Object counter, total and last week",
        route: '/api/v2/statistics/counter',
        func: require('../routes/statistics').counter,
    },
    {
        desc: "Metadata aggregation, from summary",
        route: '/api/v2/statistics/parsers',
        func: require('../routes/statistics').parsers,
    },
    {
        desc: "Granular metadata counter for stats",
        route: '/api/v2/statistics/:name/:unit/:amount',
        func: require('../routes/statistics').statistics,
    },
    // TODO document / explain
    // This is both for group performances and for content sharing, limited as much as possible,
    // by the knowledge of timelineId (which is know only to the original author)
    {
        desc: "Timeline CSV",
        route: '/api/v2/timeline/:timelineId/csv/',
        func: require('../routes/personal').timelineCSV,
    },
    /* semantics APIs */
    {
        desc: "Semantics",
        route: '/api/v2/:lang/semantics/:paging?',
        func: require('../routes/semantics').semantics,
    },
    {
        desc: "Labels",
        route: '/api/v2/:lang/labels/:paging?',
        func: require('../routes/semantics').labels,
    },
    {
        desc: "Enrich",
        route: '/api/v2/:lang/enrich/:paging?',
        func: require('../routes/semantics').enrich,
    },
    {
        desc: "Loud",
        route: '/api/v2/:lang/loud/:paging?',
        func: require('../routes/semantics').loud,
    },
    {
        desc: "Noogle",
        route: '/api/v2/:lang/noogle/:label/:paging?',
        func: require('../routes/semantics').noogle,
    },
    {
        desc: "LangInfo",
        route: '/api/v2/:lang/langinfo',
        func: require('../routes/semantics').langinfo,
    },
    {
        desc: "Languages",
        route: '/api/v2/languages',
        func: require('../routes/semantics').languages,
    },
    {
        desc: "Keywords",
        route: '/api/v2/keywords/:lang',
        func: require('../routes/semantics').keywords,
    }
];
