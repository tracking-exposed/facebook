const express = require('express');
const app = express();
const server = require('http').Server(app);
const _ = require('lodash');
const moment = require('moment');
const bodyParser = require('body-parser');
const Promise = require('bluebird');
const debug = require('debug')('fbtrex:collector');
const nconf = require('nconf');
const cors = require('cors');

// const dbutils = require('../lib/dbutils'); FUTURE
const mongo = require('../lib/mongo');
const common = require('../lib/common');
const security = require('../lib/security');

const cfgFile = "config/collector.json";
const redOn = "\033[31m";
const redOff = "\033[0m";

nconf.argv().env().file({ file: cfgFile });
console.log(redOn + "ઉ nconf loaded, using " + cfgFile + redOff);

if(nconf.get('FBTREX') !== 'production') {
    debug("Because $FBTREX is not 'production', it is assumed be 'development'");
    nconf.stores.env.readOnly = false;
    nconf.set('FBTREX', 'development');
    nconf.stores.env.readOnly = true;
} else {
    debug("Production execution!");
}

const collectorImplementations = {
    processEvents:    require('../routes/events').processEvents,
    userInfo:         require('../routes/selector').userInfo,
    getMirror:        require('../routes/events').getMirror,
};

function dispatchPromise(name, req, res) {

    var apiV = _.parseInt(_.get(req.params, 'version'));
    /* force version to the only supported version */
    if(_.isNaN(apiV) || (apiV).constructor !== Number || apiV != 1)
        apiV = 1;

    debug("%s API %s (%s)", moment().format("HH:mm:ss"), name, req.url);

    var func = _.get(collectorImplementations, name);

    if(!func)
        return common.returnHTTPError(req, res, name, "Implementation error: function not found?");

    /* in theory here we can keep track of time */
    return new Promise.resolve(func(req))
      .then(function(httpresult) {

          if(_.isObject(httpresult.headers))
              _.each(httpresult.headers, function(value, key) {
                  debug("Setting header %s: %s", key, value);
                  res.setHeader(key, value);
              });

          if(httpresult.json) {
              debug("API %s (%d bytes) success, returning JSON (%d bytes)",
                  name, _.size(JSON.stringify(req.body)),
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
              return common.returnHTTPError(req, res, name, "Undetermined failure");
          }
          return true;
      })
      .catch(function(error) {
          debug("Trigger an Exception %s: %s", name, error);
          return common.returnHTTPError(req, res, name, "Exception");
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

/* special input mirroring functionality */
app.get('/api/v1/mirror/:key', function(req, res) {
    return dispatchPromise('getMirror', req, res);
});

Promise.resolve().then(function() {
  return mongo
    .count(nconf.get('schema').supporters)
    .then(function(amount) {
       debug("mongodb is running, found %d supporters", amount);
    })
    .catch(function(error) {
       console.log("mongodb is not accessible: check", cfgFile, error.message);
       process.exit(1);
    });
});

security.checkKeyIsSet();
