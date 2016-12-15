var express = require('express');
var app = express();
var server = require('http').Server(app);
var _ = require('lodash');
var moment = require('moment');
var bodyParser = require('body-parser');
var Promise = require('bluebird');
var mongodb = Promise.promisifyAll(require('mongodb'));
var debug = require('debug')('fbtrex');
var nconf = require('nconf');
var jade = require('jade');
var cors = require('cors');

var utils = require('./lib/utils');
var escviAPI = require('./lib/allversions');

var cfgFile = "config/settings.json";
var redOn = "\033[31m";
var redOff = "\033[0m";

nconf.argv()
     .env()
     .file({ file: cfgFile });
console.log(redOn + "ઉ nconf loaded, using " + cfgFile + redOff);

var returnHTTPError = function(req, res, funcName, where) {
    debug("%s HTTP error 500 %s [%s]", req.randomUnicode, funcName, where);
    res.status(500);
    return false;
};

/* This function wraps all the API call, checking the verionNumber
 * managing error in 4XX/5XX messages and making all these asyncronous
 * I/O with DB, inside this Bluebird */
var inc = 0;
var dispatchPromise = function(name, req, res) {

    var apiV = _.parseInt(_.get(req.params, 'version'));

    /* force version to the only supported version */
    if(_.isNaN(apiV) || (apiV).constructor !== Number || apiV != 1)
        apiV = 1;

    if(_.isUndefined(req.randomUnicode)) {
        req.randomUnicode = inc;
        inc += 1;
    }

    debug("%s %s API v%d name %s (%s)", req.randomUnicode,
        moment().format("HH:mm:ss"), apiV, name, req.url);

    var func = _.get(escviAPI.implementations, name, null);

    if(_.isNull(func))
        return returnHTTPError(req, res, name, "Not a function request");

    /* in theory here we can keep track of time */
    return new Promise.resolve(func(req))
      .then(function(httpresult) {

          if(_.isObject(httpresult.headers))
              _.each(httpresult.headers, function(value, key) {
                  debug("Setting header %s: %s", key, value);
                  res.setHeader(key, value);
              });

          if(!_.isUndefined(httpresult.json)) {
              debug("%s API %s success, returning JSON (%d bytes)",
                  req.randomUnicode, name,
                  _.size(JSON.stringify(httpresult.json)) );
              res.json(httpresult.json)
          } else if(!_.isUndefined(httpresult.text)) {
              debug("%s API %s success, returning text (size %d)",
                  req.randomUnicode, name, _.size(httpresult.text));
              res.send(httpresult.text)
          } else if(!_.isUndefined(httpresult.file)) {
              /* this is used for special files, beside the css/js below */
              debug("%s API %s success, returning file (%s)",
                  req.randomUnicode, name, httpresult.file);
              res.sendFile(__dirname + "/html/" + httpresult.file);
          } else {
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
server.listen(nconf.get('port'), '127.0.0.1');
console.log("  Port " + nconf.get('port') + " listening");
/* configuration of express4 */
app.use(cors());
app.use(bodyParser.json({limit: '3mb'}));
app.use(bodyParser.urlencoded({limit: '3mb', extended: true}));

app.get('/api/v:version/node/info', function(req, res) {
    return dispatchPromise('nodeInfo', req, res);
});

/* byDay (impressions, users, metadata ) */
app.get('/api/v:version/daily/:what', function(req, res) {
    return dispatchPromise('byDayStats', req, res);
});

/* column only - c3 */
app.get('/api/v:version/node/countries/c3', function(req, res) {
    return dispatchPromise('countriesStats', req, res);
});

app.get('/api/v:version/post/reality/:postId', function(req, res) {
    return dispatchPromise('postReality', req, res);
});
app.get('/api/v:version/post/perceived/:postId/:userId', function(req, res){
    return dispatchPromise('postLife', req, res);
});
app.get('/api/v:version/user/timeline/:userId/:past/:R/:P', function(req, res) {
    return dispatchPromise('userTimeLine', req, res);
});
app.get('/api/v:version/user/:kind/:CPN/:userId/:format', function(req, res){
    return dispatchPromise('userAnalysis', req, res);
});

/* Parser API */
app.post('/api/v:version/snippet/status', function(req, res) {
    return dispatchPromise('snippetAvailable', req, res);
});
app.post('/api/v:version/snippet/content', function(req, res) {
    return dispatchPromise('snippetContent', req, res);
});
app.post('/api/v:version/snippet/result', function(req, res) {
    return dispatchPromise('snippetResult', req, res);
});


/* This is import and validate the key */
app.post('/api/v:version/validate', function(req, res) {
    return dispatchPromise('validateKey', req, res);
});
/* This to actually post the event collection */
app.post('/api/v:version/events', function(req, res) {
    return dispatchPromise('processEvents', req, res);
});


// app.post('/api/v:version/contrib/:which', function(req, res) {
//     return dispatchPromise('writeContrib', req, res);
// });


app.get('/realitycheck/:userId', function(req, res) {
    req.params.page = 'realitycheck';
    return dispatchPromise('getPage', req, res);
});
app.get('/realitymeter/:postId', function(req, res) {
    return dispatchPromise('getRealityMeter', req, res);
});
app.get('/realitymeter', function(req, res) {
    return dispatchPromise('getRealityMeter', req, res);
});
app.get('/impact', function(req, res) {
    return dispatchPromise('getImpact', req, res);
});
/* special, admin, to become auth ? */
app.post('/api/v1/manualboarding', function(req, res) {
    return dispatchPromise('manualBoarding', req, res);
});
/* static files, independent by the API versioning */
app.get('/favicon.ico', function(req, res) {
    res.sendFile(__dirname + '/dist/favicon.ico');
});
app.get('/facebook.tracking.exposed.user.js', function (req, res) {
    var ipaddr = _.get(req.headers, "x-forwarded-for") || "127.0.0.1";
    debug("ScriptLastVersion requested in %j", utils.getGeoIP(ipaddr));
    res.sendFile(__dirname + '/scriptlastversion');
});


/* development: the local JS are pick w/out "npm run build" every time, and
 * our locally developed scripts stay in /js/local */
if(nconf.get('development') === 'true') {
    console.log(redOn + "ઉ DEVELOPMENT = serving JS from src" + redOff);
    app.use('/js/local', express.static(__dirname + '/sections/webscripts'));
} else {
    app.use('/js/local', express.static(__dirname + '/dist/js/local'));
}

/* catch the other 'vendor' script in /js */
app.use('/js', express.static(__dirname + '/dist/js'));
app.use('/css', express.static(__dirname + '/dist/css'));
app.use('/images', express.static(__dirname + '/dist/images'));
app.use('/fonts', express.static(__dirname + '/dist/fonts'));

/* last one, page name catch-all */
app.get('/:page', function(req, res) {
    return dispatchPromise('getPage', req, res);
});
/* true last */
app.get('/', function(req, res) {
    return dispatchPromise('getPage', req, res);
});


