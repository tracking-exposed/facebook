var express = require('express');
var app = express();
var server = require('http').Server(app);
var _ = require('lodash');
var moment = require('moment');
var bodyParser = require('body-parser');
var Promise = require('bluebird');
var debug = require('debug')('fbtrex:collector');
var nconf = require('nconf');
var cors = require('cors');

var cfgFile = "config/collector.json";
var redOn = "\033[31m";
var redOff = "\033[0m";

var echoes = require("../lib/echoes")
echoes.addEcho("elasticsearch")
echoes.setDefaultEcho("elasticsearch")

nconf.argv().env().file({ file: cfgFile });
console.log(redOn + "ઉ nconf loaded, using " + cfgFile + redOff);

var returnHTTPError = function(req, res, funcName, where) {
    debug("HTTP error 500 %s [%s]", funcName, where);
    res.status(500);
    res.send();
    return false;
};


const collectorImplementations = {
    processEvents:    require('../routes/events').processEvents,
    getSelector:      require('../routes/selector').getSelector,
    userInfo:         require('../routes/selector').userInfo,
};

function dispatchPromise(name, req, res) {

    var apiV = _.parseInt(_.get(req.params, 'version'));
    /* force version to the only supported version */
    if(_.isNaN(apiV) || (apiV).constructor !== Number || apiV != 1)
        apiV = 1;

    debug("%s API %s (%s)", moment().format("HH:mm:ss"), name, req.url);

    var func = _.get(collectorImplementations, name);

    if(!func)
        return returnHTTPError(req, res, name, "Implementation error: function not found?");

    /* in theory here we can keep track of time */
    return new Promise.resolve(func(req))
      .then(function(httpresult) {

          if(_.isObject(httpresult.headers))
              _.each(httpresult.headers, function(value, key) {
                  debug("Setting header %s: %s", key, value);
                  res.setHeader(key, value);
              });

          if(httpresult.json) {
              debug("API %s success, returning JSON (%d bytes)",
                  name,
                  _.size(JSON.stringify(httpresult.json)) );
              res.json(httpresult.json)
          } else if(httpresult.text) {
              debug("API %s success, returning text (size %d)",
                  name, _.size(httpresult.text));
              res.send(httpresult.text)
          } else if(httpresult.file) {
              /* this is used for special files, beside the css/js below */
              debug("API %s success, returning file (%s)",
                  name, httpresult.file);
              res.sendFile(__dirname + "/html/" + httpresult.file);
          } else {
              debug("Undetermined failure in API call, result →  %j", httpresult);
              console.trace();
              return returnHTTPError(req, res, name, "Undetermined failure");
          }
          return true;
      })
      .catch(function(error) {
          debug("Trigger an Exception %s: %s",
              name, error);
          return returnHTTPError(req, res, name, "Exception");
      });
};

server.listen(nconf.get('port'), nconf.get('interface'));
debug("Listening on http://%s:%s", nconf.get('interface'), nconf.get('port'));

/* configuration of express4 */
app.use(cors());
app.use(bodyParser.json({limit: '4mb'}));
app.use(bodyParser.urlencoded({limit: '4mb', extended: true}));

/* This to actually post the event collection */
app.post('/api/v:version/events', function(req, res) {
    return dispatchPromise('processEvents', req, res);
});
app.post('/api/v1/userInfo', function(req, res) {
    return dispatchPromise('userInfo', req, res);
});
/* should be discontinued -- under check if is still used */
app.get('/api/v1/selector', function(req, res) {
    return dispatchPromise('getSelector', req, res);
});
