module.exports = [
    /* debug API, some authenticated, some not necessarly used */
    { 
        desc: "individual parser verification",
        route: '/api/v2/debug/html/:htmlId',
        func: require('../routes/htmlunit').unitById
    },
    {
        desc: "page navigator for parser debugging",
        route: '/api/v2/debug/:key/date/:savingTime',
        func: require('../routes/htmlunit').unitByDate,
    },
    {
        desc: "full timeline verification",
        route: '/api/v2/debug/:timelineId',
        func: require('../routes/htmlunit').verifyTimeline
    },
    {
        desc: "Testing tool, random timeline downloader",
        route: '/api/v2/debug/exporter/:key/:sample',
        func: require('../routes/exporter').exporter,
    },
    /* RSS feed */
    {
        desc: "RSS v2 feed fetcher",
        route: '/2/feeds/:query',
        func: require('../routes/feeds').feeds,
    },
    /* health check */
    {
        desc: "Health check",
        route: '/api/health',
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
        func: require('../routes/personal').csv,
    },
    {
        desc: "Personal Summary+Semantics",
        route: '/api/v2/personal/:userToken/semantics/:paging?',
        func: require('../routes/personal').semantics,
    },
    {
        desc: "Personal Stats",
        route: '/api/v2/personal/:userToken/stats/:dayrange?',
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
        route: '/api/v2/statistics/aggregated/:raw?',
        func: require('../routes/statistics').aggregated,
    },
    {
        desc: "Parsers performances",
        route: '/api/v2/statistics/parsers/:key',
        func: require('../routes/statistics').parsers,
    },
    // TODO testing group performances, to be linked with the collective API
];

