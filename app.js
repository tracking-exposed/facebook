var express = require('express');
var app = express();
var server = require('http').Server(app);
var _ = require('lodash');
var io = require('socket.io')(server);
var moment = require('moment');
var bodyParser = require('body-parser');
var Promise = require('bluebird');
var mongodb = Promise.promisifyAll(require('mongodb'));
var debug = require('debug')('fbtrex');
var nconf = require('nconf');
var jade = require('jade');

var utils = require('./lib/utils');
var escviAPI = require('./lib/allversions');

var cfgFile = "config/settings.json";
var redOn = "\033[31m";
var redOff = "\033[0m";

nconf.argv()
     .env()
     .file({ file: cfgFile });
console.log(redOn + "ઉ nconf loaded, using " + cfgFile + redOff);

var wrapError = function(where, v, fn, nfo) {
    var str = redOn + " " + where + " Developer mistake v(" + 
              v + ") " + fn + "\n" + 
              JSON.stringify(nfo, undefined, 2) + redOff;
    console.log(str);
};

/* This function wraps all the API call, checking the verionNumber
 * managing error in 4XX/5XX messages and making all these asyncronous
 * I/O with DB, inside this Bluebird */
var dispatchPromise = function(name, req, res) {

    var apiV = _.parseInt(_.get(req.params, 'version'));

    if(_.isNaN(apiV) || (apiV).constructor !== Number )
        apiV = escviAPI.lastVersion;

    req.randomUnicode = String.fromCharCode(_.random(0x0391, 0x085e));
    debug("%s %s API v %d name %s (%s)", req.randomUnicode,
        moment().format("HH:mm:ss"), apiV, name, req.url);

    var func = _.reduce(_.times(apiV + 1), function(memo, i) {
        var f = _.get(_.get(escviAPI.implementations, 'version' + i), name);
        if(!_.isUndefined(f))
            memo = f;
        return memo;
    }, null);

    if(_.isNull(func)) {
        debug("%s Wrong function name used %s", name);
        wrapError("pre-exec", apiV, funcName, req.params, res);
        res.status(500);
        res.send('error');
        return false;
    }

    /* in theory here we can keep track of time */
    return new Promise.resolve(func(req))
      .then(function(httpresult) {
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
          } else if(!_.isUndefined(httpresult.error)) {
              res.json(httpresult.error)
              res.header(500);
              return false;
          } else {
              debug("%s Failure %j", req.randomUnicode, httpresult);
              res.status(500);
              res.send('error');
              return false;
          }
          return true;
      }) 
};

/* everything begin here, welcome */
server.listen(nconf.get('port'));
console.log("  Port " + nconf.get('port') + " listening");
/* configuration of express4 */
app.use(bodyParser.json({limit: '3mb'}));
app.use(bodyParser.urlencoded({limit: '3mb', extended: true}));

app.get('/node/info/:version', function(req, res) {
    return dispatchPromise('nodeInfo', req, res);
});
app.get('/node/export/:version/:shard', function(req, res) {
    return dispatchPromise('nodeExport', req, res);
});
app.get('/node/activity/:version/:format', function(req, res) {
    return dispatchPromise('byDayActivity', req, res);
});
app.get('/node/countries/:version/:format', function(req, res) {
    return dispatchPromise('countriesStats', req, res);
});
app.get('/node/country/:version/:countryCode/:format', function(req, res) {
    return dispatchPromise('countryStatsByDay', req, res);
});
app.get('/post/reality/:version/:postId', function(req, res) {
    return dispatchPromise('postReality', req, res);
});
app.get('/post/perceived/:version/:postId/:userId', function(req, res){
    return dispatchPromise('postLife', req, res);
});
app.get('/user/:version/timeline/:userId/:past/:R/:P', function(req, res) {
    return dispatchPromise('userTimeLine', req, res);
});
app.get('/user/:version/analysis/:kind/:cpn/:userId/:format', function(req, res) {
    return dispatchPromise('userAnalysis', req, res);
});
app.post('/F/:version', function(req, res) {
    return dispatchPromise('postFeed', req, res);
});
app.post('/v:version/timelines', function(req, res) {
    return dispatchPromise('postFeed', req, res);
});
app.post('/v:version/dom', function(req, res) {
    return dispatchPromise('postDebug', req, res);
});
app.post('/D/:version', function(req, res) {
    return dispatchPromise('postDebug', req, res);
});
app.post('/contrib/:version/:which', function(req, res) {
    return dispatchPromise('writeContrib', req, res);
});
/* Only the *last version* is imply in the API below */
/* legacy because the script it is still pointing here */
app.get('/realitycheck/:userId', function(req, res) {
    _.set(req.params, 'page', 'timelines');
    return dispatchPromise('getPersonal', req, res);
});
app.get('/realitycheck/:page/random', function(req, res) {
    return dispatchPromise('getRandom', req, res);
});
app.get('/realitycheck/:page/:userId', function(req, res) {
    return dispatchPromise('getPersonal', req, res);
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
/* static files, independent by the API versioning */
app.get('/favicon.ico', function(req, res) {
    res.sendFile(__dirname + '/dist/favicon.ico');
});
app.get('/facebook.tracking.exposed.user.js', function (req, res) {
    var ipaddr = _.get(req.headers, "x-forwarded-for") || "127.0.0.1";
    debug("ScriptLastVersion requested in %j", utils.getGeoIP(ipaddr));
    res.sendFile(__dirname + '/scriptlastversion');
});

app.use('/css', express.static(__dirname + '/dist/css'));
app.use('/images', express.static(__dirname + '/dist/images'));
app.use('/lib/font/league-gothic', express.static(__dirname + '/dist/css'));

app.use('/js/vendor', express.static(__dirname + '/dist/js/vendor'));
/* development: the local JS are pick w/out "npm run build" every time */
if(nconf.get('development') === 'true') {
    console.log(redOn + "ઉ DEVELOPMENT = serving JS from src" + redOff);
    app.use('/js/local', express.static(__dirname + '/sections/webscripts'));
} else {
    app.use('/js/local', express.static(__dirname + '/dist/js/local'));
}
/* last one, page name catch-all */
app.get('/:page', function(req, res) {
    return dispatchPromise('getPage', req, res);
});
/* true last */
app.get('/', function(req, res) {
    return dispatchPromise('getPage', req, res);
});


/* websocket configuration and definition of the routes */
io.on('connection', function (socket) {
    socket.emit('news', { hello: 'world' });
    socket.on('my other event', function (data) {
        debug("socket.io 'my other event': %j", data);
        return { some: true };
    });
    socket.on('AAA', function(stuff) {
        debug("My AAA");
        console.log(JSON.stringify(stuff, undefined, 2));
        return { some: false };
    });
});

