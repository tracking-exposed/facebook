#!/usr/bin/env nodejs
var _ = require('lodash');
var Promise = require('bluebird');
var util = require('util');
var fs = Promise.promisifyAll(require('fs'));
var request = Promise.promisifyAll(require('request'));
var debug = require('debug')('reSender');
var nconf = require('nconf')

var url ='http://localhost:8000';
// var url ='https://facebook.tracking.exposed';

nconf.argv().env();

if ( _.isUndefined(nconf.get('DEBUG')) || 
     _.isNaN(_.parseInt(nconf.get('delay'))) ) {
    console.log("Set 'DEBUG' env variable and 'delay' ");
    return -1;
}

var delayTime = _.parseInt(nconf.get('delay'));

var files = fs
    .readdirAsync('samples')
    .then(function(files) {
        debugger;
        if(_.isUndefined(nconf.get('file'))) {
          // TODO hook the --unit and send only that 
            return files;
        } else {

            debug("Using the single file as configured");
            delayTime = 0;
            return [ nconf.get('file') ];
        }
    });

debug("Using url %s", url);
return Promise.reduce(files, function(memo, fname, i, total) {
      debug("Processing \t%d/%d\t%s", i, total, fname);
      var fpath = 'samples/' + fname;
      return fs.readFileAsync(fpath, "utf-8")
        .then(JSON.parse)
        .then(function(filecontent) {
          var unitN = _.parseInt(nconf.get('unit'));
          if(!_.isNaN(unitN)) {
              debug("Selecting unit %d only to improve debug", unitN);
              var reusableBody = { 
                  timeline : [ filecontent.body.timeline[unitN] ],
                  from: filecontent.body.from
              };
          } else {
              var reusableBody = filecontent.body;
              debug("firing error from %s", filecontent.user.href);
          }
          return request({
            url: url + '/F/2',
            method: "POST",
            body: reusableBody,
            json: true
          });
        })
        .delay(delayTime)
        .then(function(result) {
            memo[fpath] = true;
            return memo;
        })
        .catch(function(error) {
            debug("ERROR!: %j", error);
            memo[fpath] = false;
            return memo;
        });
  }, []);
