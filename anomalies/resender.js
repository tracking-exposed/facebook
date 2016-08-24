#!/usr/bin/env nodejs
var _ = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var request = Promise.promisifyAll(require('request'));
var debug = require('debug')('reSender');
var nconf = require('nconf')


var url ='http://localhost:8000';
// var url ='https://facebook.tracking.exposed';

nconf.argv()
     .env();

if (_.isNaN(_.parseInt(nconf.get('delay')))) {
    console.log("env variable 'delay' is required");
    return -1;
}

debug("Using url %s", url);
return fs
  .readdirAsync('samples')
  .reduce(function(memo, fname, i, total) {
      debug("Processing file\t%d\t%d\t%s", i, total, fname);
      var fpath = 'samples/' + fname;
      return fs.readFileAsync(fpath, "utf-8")
        .then(JSON.parse)
        .then(function(filecontent) {
          return request({
            url: url + '/F/2',
            method: "POST",
            body: filecontent.body,
            json: true
          });
        })
        .then(function(result) {
            debug("File %s result: %j", fpath, result);
            memo[fpath] = true;
            return memo;
        })
        .delay(_.parseInt(nconf.get('delay')))
        .catch(function(error) {
            debug("File %s ERROR!: %j", fpath, error);
            memo[fpath] = false;
            return memo;
        });
  }, []);
