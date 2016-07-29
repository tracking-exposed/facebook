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
var jade = require('jade');
var yargs = require('yargs')
    .nargs('p', 1)
        .alias('p', 'port')
        .string('p')
        .describe('local TCP port')
    .config('c')
    .help('h')
    .demand(['c']);

var escviAPI = require('./lib/allversions');
var token = require('./lib/token');

/* Claudio's debug */
var CD = function(content) {
    console.log("ŊŊ " + JSON.stringify(content, undefined, 2));
};
var PORT = 4444; // 8000;

CD(yargs);
setTimeout(token.periodicCheck, token.tokenLifetime * 1000);
server.listen(PORT);
console.log("Please proceed with your spam at port " + PORT);

app.use(bodyParser.json()); // for parsing application/json


/* This function wraps all the API call, checking the verionNumber
 * managing error in 4XX/5XX messages and making all these asyncronous
 * I/O with DB, inside this Bluebird */
var dispatchPromise = function(funcName, req, res) {

    var apiV = _.parseInt(_.get(req.params, 'versionNumber'));

    /* only anomaly managed here: '/' has not an API version */
    if(req.url == '/')
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
          }
          return true;
      }) 
};

app.get('/admin/stats/system/:versionNumber/', function(req, res) {
    return dispatchPromise('adminStats', req, res);
});
app.get('/admin/stats/token/:versionNumber/', function(req, res) {
    return dispatchPromise('adminTokenCheck', req, res);
});
app.get('/public/stats/:versionNumber/', function(req, res) {
    return dispatchPromise('publicStats', req, res);
});
app.get('/user/public/:versionNumber/:profileId', function(req, res) {
    return dispatchPromise('userPublicPage', req, res);
});
app.get('/user/private/:versionNumber/:secret', function(req, res) {
    return dispatchPromise('userPrivateView', req, res);
});
app.get('/node/export/:versionNumber/:selector', function(req, res) {
    return dispatchPromise('exportNode', req, res);
});
app.post('/F/:versionNumber', function(req, res) {
    return dispatchPromise('postFeed', req, res);
});
app.get('/token/:versionNumber/:reason/:profileId', function(req, res) {
    return dispatchPromise('getToken', req, res);
});
app.post('/contrib/:versionNumber/:which', function(req, res) {
    return dispatchPromise('writeContrib', req, res);
});
app.get('/', function(req, res) {
    return dispatchPromise('getIndex', req, res);
});
app.get('/favicon.ico', function(req, res) {
    res.sendFile(__dirname + '/dist/favicon.ico');
});
app.get('/facebook.tracking.exposed.user.js', function (req, res) {
    res.sendFile(__dirname + '/scriptlastversion');
});
app.use('/dist', express.static(__dirname + '/dist'));

/* I don't know yet if I'm gonna need this because depends on 
 * how the UX get developed during the time */
io.on('connection', function (socket) {
    socket.emit('news', { hello: 'world' });
    socket.on('my other event', function (data) {
        console.log(data);
    });
});

