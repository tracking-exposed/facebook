#!/usr/bin/env nodejs
var _ = require('lodash');
var Promise = require('bluebird');
var util = require('util');
var fs = Promise.promisifyAll(require('fs'));
var request = Promise.promisifyAll(require('request'));
var debug = require('debug')('stressTest');
var nconf = require('nconf')

nconf.argv().env();

if ( _.isUndefined(nconf.get('DEBUG')) || 
     _.isNaN(_.parseInt(nconf.get('delay'))) ||
     _.isNaN(_.parseInt(nconf.get('times'))) ||
     _.isUndefined(nconf.get('source')) ) {
    console.log("Set: DEBUG url delay times source as environment var");
    return -1;
}

var delayTime = _.parseInt(nconf.get('delay'));

return Promise
  .map((nconf.get('source')).split(','), function(fpath) {
    return fs.readFileAsync(fpath, "utf-8")
      .then(JSON.parse)
      .then(function(saved) {
        return Promise
          .map(_.times(_.parseInt(nconf.get('times'))), function(i) {
            debug("Shooting the request number %d %s", i, fpath);
            return request.postAsync(nconf.get('url') + '/api/v1/events', {
              form: saved.body,
              headers: saved.headers
            })
            .catch(function(err) {
              debug("error in %d %s: %s", i, fpath, err);
            })
            .delay(_.parseInt(nconf.get('delay')))
          }, {concurrency: 10});
      })
  }, { concurrency: 0} );
