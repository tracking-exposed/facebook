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
var geoip = require('geoip-native');
var nconf = require('nconf');
var jade = require('jade');

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

    var apiV = _.parseInt(_.get(req.params, 'versionNumber'));

    /* The versionless routes are here */
    if( req.url == '/' || 
        _.startsWith(req.url, '/realitycheck/') || 
        _.startsWith(req.url, '/overseer/') )
        apiV = escviAPI.lastVersion;

    if(_.isUndefined(apiV) || (apiV).constructor !== Number )
        return res.sendStatus(400);

    var func = _.get(escviAPI.implementations['version' + apiV], funcName);

    if(_.isUndefined(func)) {
        throw new Error("Developer mistake with version " + 
                       apiV + " f " + funcName);
    }

    req.randomUnicode = String.fromCharCode(_.random(0x0391, 0x085e));

    debug("%s %s Dispatching request to %s", 
        req.randomUnicode, 
        moment().format("MM-DD hh:mm:ss"), req.url);

    /* in theory here we can keep track of time */
    return new Promise.resolve(func(req))
      .then(function(httpresult) {
          // res.header(httpresult.header);
          if(!_.isUndefined(httpresult.json)) {
              debug("%s API %s success, returning JSON",
                  req.randomUnicode, funcName);
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
              throw new Error("Internal developer mistake");
          }
          return true;
      }) 
};

/* everything begin here, welcome */
server.listen(nconf.get('port'));
console.log("  Port " + nconf.get('port') + " listening");
app.use(bodyParser.json()); 

app.get('/admin/stats/system/:versionNumber/', function(req, res) {
    return dispatchPromise('adminStats', req, res);
});
app.get('/admin/view/:versionNumber/', function(req, res) {
    return dispatchPromise('adminDataView', req, res);
});
app.get('/public/stats/:versionNumber/', function(req, res) {
    return dispatchPromise('publicStats', req, res);
});
app.get('/user/public/:versionNumber/TL/:profileId', function(req, res) {
    return dispatchPromise('userTimeLine', req, res);
});
app.get('/node/export/:versionNumber/:table/:selector', function(req, res) {
    return dispatchPromise('exportNode', req, res);
});
app.post('/F/:versionNumber', function(req, res) {
    return dispatchPromise('postFeed', req, res);
});
app.post('/contrib/:versionNumber/:which', function(req, res) {
    return dispatchPromise('writeContrib', req, res);
});
/* Only the *last version* is imply in the API below */
app.get('/', function(req, res) {
    return dispatchPromise('getIndex', req, res);
});
app.get('/realitycheck/:profileId', function(req, res) {
    return dispatchPromise('getPersonal', req, res);
});
app.get('/overseer', function(req, res) {
    return dispatchPromise('getOverseer', req, res);
});
/* static files, independent by the API versioning */
app.get('/favicon.ico', function(req, res) {
    res.sendFile(__dirname + '/dist/favicon.ico');
});
app.get('/facebook.tracking.exposed.user.js', function (req, res) {
    res.sendFile(__dirname + '/scriptlastversion');
});
app.use('/js', express.static(__dirname + '/dist/js'));
app.use('/css', express.static(__dirname + '/dist/css'));

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

