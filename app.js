var express = require('express');
var app = express();
var server = require('http').Server(app);
var _ = require('lodash');
var io = require('socket.io')(server);
var moment = require('moment');
var bodyParser = require('body-parser');
var Promise = require('bluebird');
var mongodb = Promise.promisifyAll(require('mongodb'));
var debug = require('debug')('ESCVI');
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

/* This function wraps all the API call, checking the verionNumber
 * managing error in 4XX/5XX messages and making all these asyncronous
 * I/O with DB, inside this Bluebird */
var dispatchPromise = function(funcName, req, res) {

    var apiV = _.parseInt(_.get(req.params, 'version'));

    if(_.isNaN(apiV) || (apiV).constructor !== Number )
        apiV = escviAPI.lastVersion;

    var func = _.get(escviAPI.implementations['version' + apiV], funcName);

    if(_.isUndefined(func)) {
        debug("Developer mistake with version %d %s ", apiV, funcName);
        throw new Error("Developer mistake with version " + 
                       apiV + " f " + funcName);
    }

    req.randomUnicode = String.fromCharCode(_.random(0x0391, 0x085e));
    debug("%s %s Dispatching request to %s", 
        req.randomUnicode, moment().format("HH:mm:ss"), req.url);

    /* in theory here we can keep track of time */
    return new Promise.resolve(func(req))
      .then(function(httpresult) {
          // res.header(httpresult.header);
          if(!_.isUndefined(httpresult.json)) {
              debug("%s API %s success, returning JSON (%d bytes)",
                  req.randomUnicode, funcName,
                  _.size(JSON.stringify(httpresult.json)) );
              res.json(httpresult.json)
          } else if(!_.isUndefined(httpresult.text)) {
              debug("%s API %s success, returning text (size %d)",
                  req.randomUnicode, funcName, _.size(httpresult.text));
              res.send(httpresult.text)
          } else if(!_.isUndefined(httpresult.file)) {
              /* this is used for special files, beside the css/js below */
              debug("%s API %s success, returning file (%s)",
                  req.randomUnicode, funcName, httpresult.file);
              res.sendFile(__dirname + "/html/" + httpresult.file);
          } else {
              throw new Error("Internal developer mistake |" + funcName);
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
app.get('/post/top/:version', function(req, res) {
    return dispatchPromise('topPosts', req, res);
});
app.get('/post/reality/:version/:postId', function(req, res) {
    return dispatchPromise('postReality', req, res);
});
app.get('/post/perceived/:version/:postId/:userId', function(req,res){
    return dispatchPromise('postLife', req, res);
});
app.get('/user/:version/timeline/:userId/:past/:R/:P', function(req, res) {
    return dispatchPromise('userTimeLine', req, res);
});
app.get('/user/:version/daily/:userId/:format', function(req, res) {
    return dispatchPromise('byDayActivity', req, res);
});
app.get('/user/:version/analysis/:kind/:userId/:format', function(req, res) {
    return dispatchPromise('processedUserLog', req, res);
});
app.post('/F/:version', function(req, res) {
    return dispatchPromise('postFeed', req, res);
});
app.post('/D/:version', function(req, res) {
    return dispatchPromise('postDebug', req, res);
});
app.post('/contrib/:version/:which', function(req, res) {
    return dispatchPromise('writeContrib', req, res);
});
/* Only the *last version* is imply in the API below */
app.get('/', function(req, res) {
    return dispatchPromise('getIndex', req, res);
});
app.get('/page-:name', function(req, res) {
    return dispatchPromise('getPage', req, res);
});
app.get('/realitycheck/:userId', function(req, res) {
    return dispatchPromise('getPersonal', req, res);
});
app.get('/overseer', function(req, res) {
    return dispatchPromise('getOverseer', req, res);
});
app.get('/realitymeter', function(req, res) {
    return dispatchPromise('getRealityMeter', req, res);
});
app.get('/realitymeter/:postId', function(req, res) {
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
app.use('/js', express.static(__dirname + '/dist/js'));
app.use('/css', express.static(__dirname + '/dist/css'));
app.use('/images', express.static(__dirname + '/dist/images'));
app.use('/lib/font/league-gothic', express.static(__dirname + '/dist/css'));

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

