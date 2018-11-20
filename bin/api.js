var express = require('express');
var app = express();
var server = require('http').Server(app);
var _ = require('lodash');
var moment = require('moment');
var bodyParser = require('body-parser');
var Promise = require('bluebird');
var mongodb = Promise.promisifyAll(require('mongodb'));
var debug = require('debug')('fbtrex:api');
var nconf = require('nconf');
var pug = require('pug');
var cors = require('cors');

var utils = require('../lib/utils');
var escviAPI = require('../lib/allversions');
var performa = require('../lib/performa');
var mongo = require('../lib/mongo');

var cfgFile = "config/settings.json";
var redOn = "\033[31m";
var redOff = "\033[0m";

var echoes = require("../lib/echoes")
echoes.addEcho("elasticsearch")
echoes.setDefaultEcho("elasticsearch")

nconf.argv().env().file({ file: cfgFile });

console.log(redOn + "ઉ nconf loaded, using " + cfgFile + redOff);

if(!nconf.get('interface') || !nconf.get('port') )
    throw new Error("check your config/settings.json, config of 'interface' and 'post' missing");

var returnHTTPError = function(req, res, funcName, where) {
    debug("%s HTTP error 500 %s [%s]", req.randomUnicode, funcName, where);
    res.status(500);
    res.send();
    return false;
};


/* This function wraps all the API call, checking the verionNumber
 * managing error in 4XX/5XX messages and making all these asyncronous
 * I/O with DB, inside this Bluebird */
var inc = 0;
function dispatchPromise(name, req, res) {

    var apiV = _.parseInt(_.get(req.params, 'version'));

    if(apiV != 2)
        debug("Migration error: the API are implemented as /api/v2");

    /* force version to the only supported version */
    if(_.isNaN(apiV) || (apiV).constructor !== Number || apiV != 2)
        apiV = 2;

    if(_.isUndefined(req.randomUnicode)) {
        req.randomUnicode = inc;
        inc += 1;
    }

    debug("%s %s API v%d name %s (%s)", req.randomUnicode,
        moment().format("HH:mm:ss"), apiV, name, req.url);

    var func = _.get(escviAPI.implementations, name, null);

    if(_.isNull(func))
        return returnHTTPError(req, res, name, "function not found?");

    /* in theory here we can keep track of time */
    return new Promise.resolve(func(req))
      .then(function(httpresult) {

          if(_.isObject(httpresult.headers))
              _.each(httpresult.headers, function(value, key) {
                  debug("Setting header %s: %s", key, value);
                  res.setHeader(key, value);
              });

          if(httpresult.json) {
              debug("%s API %s success, returning JSON (%d bytes)",
                  req.randomUnicode, name,
                  _.size(JSON.stringify(httpresult.json)) );
              res.json(httpresult.json)
          } else if(httpresult.text) {
              debug("%s API %s success, returning text (size %d)",
                  req.randomUnicode, name, _.size(httpresult.text));
              res.send(httpresult.text)
          } else if(httpresult.file) {
              /* this is used for special files, beside the css/js below */
              debug("%s API %s success, returning file (%s)",
                  req.randomUnicode, name, httpresult.file);
              res.sendFile(__dirname + "/html/" + httpresult.file);
          } else {
              debug("Undetermined failure in API call, result →  %j", httpresult);
              console.trace();
              return returnHTTPError(req, res, name, "Undetermined failure");
          }
          return true;
      })
      .catch(function(error) {
          debug("%s Trigger an Exception %s: %s",
              req.randomUnicode, name, error);
          return returnHTTPError(req, res, name, "Exception");
      });
};

/* everything begin here, welcome */
server.listen(nconf.get('port'), nconf.get('interface'));
console.log(" Listening on http://" + nconf.get('interface') + ":" + nconf.get('port'));
/* configuration of express4 */
app.use(cors());
app.use(bodyParser.json({limit: '1mb'}));
app.use(bodyParser.urlencoded({limit: '1mb', extended: true}));

app.get('/api/v:version/node/info', function(req, res) {
    return dispatchPromise('nodeInfo', req, res);
});

/* byDay (impressions, users, metadata ) -- discontinued GUI */
app.get('/api/v:version/daily/:what/:dayback', function(req, res) {
    return dispatchPromise('byDayStats', req, res);
});
/* actually used APIs for stats/impact */
app.get('/api/v:version/stats/:what/:months', function(req, res) {
    return dispatchPromise('getStats', req, res);
});
app.get('/api/v:version/stats/engagement', function(req, res) {
    return dispatchPromise('getEngagement', req, res);
});

/* column only - c3 */
app.get('/api/v:version/node/countries/c3', function(req, res) {
    return dispatchPromise('countriesStats', req, res);
});

app.get('/api/v:version/user/:kind/:CPN/:userId/:format', function(req, res){
    return dispatchPromise('userAnalysis', req, res);
});

/* Querying API */
app.post('/api/v:version/query', function(req, res) {
    return dispatchPromise('queryContent', req, res);
});



/* HTML single snippet */
app.get('/api/v:version/html/:htmlId', function(req, res) {
    return dispatchPromise('unitById', req, res);
});

/* APIs used in personal page */
app.get('/api/v:version/htmls/:userToken/days/:days', function(req, res) {
    return dispatchPromise('metadataByTime', req, res);
});
app.get('/api/v:version/htmls/:userToken/n/:skip/:amount', function(req, res) {
    return dispatchPromise('metadataByAmount', req, res);
});
app.get('/api/v:version/personal/csv/:userToken/:kind', function(req, res) {
    return dispatchPromise('personalCSV', req, res);
});
app.get('/api/v:version/personal/diet/:userToken/:days', function(req, res) {
    return dispatchPromise('dietBasic', req, res);
});

/* Alarm listing  API */
app.get('/api/v1/alarms/:auth', function(req, res) {
    return dispatchPromise('getAlarms', req, res);
});

/* realityMeter API(s) */
app.get('/api/v1/posts/top', function(req, res) {
    return dispatchPromise('getTopPosts', req, res);
});
app.get('/api/v1/realitymeter/:postId', function(req, res) {
    return dispatchPromise('postReality', req, res);
});

/* opendata export reduced data */
app.get('/api/v1/metaxpt/:selector/:type/:hoursago', function(req, res) {
    return dispatchPromise('metaxpt', req, res);
});

/* stats */
app.get('/impact', function(req, res) {
    return dispatchPromise('getImpact', req, res);
});


/* researcher API interfaces */
app.get('/api/v1/distinct/:authkey', function(req, res) {
    return dispatchPromise('distinct', req, res);
});
app.get('/api/v1/research/stats/:requestList/:start?', function(req, res) {
    return dispatchPromise('rstats', req, res);
});
app.get('/api/v1/research/data/:requestList/:start?', function(req, res) {
    return dispatchPromise('rdata', req, res);
});


/* qualitative research APIs + static pages */
app.get('/api/v1/qualitative/:rname/overview', function(req, res) {
    return dispatchPromise('qualitativeOverview', req, res);
});
app.post('/api/v1/qualitative/:rname/update/:postId', function(req, res) {
    return dispatchPromise('qualitativeUpdate', req, res);
});
app.get('/api/v1/qualitative/:rname/day/:date', function(req, res) {
    return dispatchPromise('qualitativeGet', req, res);
});
app.get('/qualitative/:rname/day/:refday', function(req, res) {
    req.params.page = 'qualitativeDaylist';
    return dispatchPromise('getPage', req, res);
});
app.get('/qualitative/:rname?', function(req, res) {
    req.params.page = 'qualitativeLanding';
    return dispatchPromise('getPage', req, res);
});


/* reducer(s) */
app.get('/api/v1/reducer/:reducerId/:authkey/:start/:end', function(req, res) {
    var rid = _.parseInt(req.params.reducerId);
    if(rid && rid < 10)
        return dispatchPromise('reducer' + rid, req, res);
});

/* RSS endpoint to glue legacy and new system */
app.get('/api/v1/exportText/:key/:seconds', function(req, res) {
    return dispatchPromise('exportText', req, res);
});

