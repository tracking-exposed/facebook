/* this module contains many functionalities in common among the express services */
const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');
const debug = require('debug')('lib:common');
const nconf = require('nconf');

/* this is the same struct of the previous version */
const utils = require('../lib/utils');

/* this is the new */
function serveRequest(desc, func, req, res) {
    let start = moment()

    /* in theory here we can keep track of time */
    return new Promise.resolve(func(req))
      .then(function(httpresult) {

          if(_.isObject(httpresult.headers))
              _.each(httpresult.headers, function(value, key) {
                  // debug("function %s sets header %s", desc, key);
                  res.setHeader(key, value);
              });

          res.setHeader('Access-Control-Allow-Origin', '*');

          if(httpresult.json) {
              debug("<%s> API success, returning JSON (%d bytes)",
                  desc, _.size(JSON.stringify(httpresult.json)) );
              res.json(httpresult.json)
          } else if(httpresult.text) {
              debug("API %s success, returning text (size %d)",
                  desc, _.size(httpresult.text));
              res.send(httpresult.text)
          } else {
              debug("Undetermined failure in API call, result →  %j", httpresult);
              console.trace();
              return returnHTTPError(req, res, desc, "Undetermined failure");
          }
          return true;
      })
      .catch(function(error) {
          debug("%s Trigger an Exception %s: %s",
              req.randomUnicode, desc, error);
          return returnHTTPError(req, res, desc, "Exception");
      });

};


/* this is the old -- still used by static pages */
function dispatchPromise(name, req, res) {

    debug("request for implemap %s", name);
    const implemap = {
        'getPage': require('./staticpages').getPage
    };
    let func = _.get(implemap, name, null);

    if(_.isNull(func))
        return returnHTTPError(req, res, name, "function not found?");

    /* in theory here we can keep track of time */
    return new Promise.resolve(func(req))
      .then(function(httpresult) {

          if(_.isObject(httpresult.headers))
              _.each(httpresult.headers, function(value, key) {
                  debug("function %s sets header %s", name, key);
                  res.setHeader(key, value);
              });

          if(httpresult.text) {
              debug("static page server: returning text (size %d)", _.size(httpresult.text));
              res.send(httpresult.text)
          } else {
              debug("Undetermined condition →  %j", httpresult);
              return returnHTTPError(req, res, name, "Undetermined failure");
          }
          return true;
      })
      .catch(function(error) {
          debug("Trigger an Exception %s: %s", name, error);
          return returnHTTPError(req, res, name, "Exception");
      });
};

function health(req, res) {
    res.send({"status": "OK"});
};

function returnHTTPError(req, res, funcName, where) {
    debug("HTTP error 500 %s [%s]", funcName, where);
    res.status(500);
    res.send();
    return false;
};


module.exports = {
    health: health,
    serveRequest: serveRequest,
    dispatchPromise: dispatchPromise,
    returnHTTPError, returnHTTPError
};

