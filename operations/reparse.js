#!/usr/bin/env nodejs

var fbParserCode = require('../userscript/fb-parser');
var _ = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('reParser');
var nconf = require('nconf');
var moment = require('moment');

var cheerio = require('cheerio');

nconf.argv().env();

var fileLocation = 'errors/client';
var files = fs.readdirAsync(fileLocation);

Promise.config({
    longStackTraces: true
});

/* I wrote it but we don't really need it ?? */
var extractClasses = function(html) {
    return _.reduce(html.split('class="'), function(memo, piece) {
        return _.concat(memo, 
            _.reduce(
                piece.replace(/<.*/, '').replace(/\".*/, '').split(' '), 
                function(clamem, cle) {
                    if(!_.startsWith(cle, '_'))
                        clamem.push(cle);
                    return clamem;
            }, []));
    }, []);
};

return Promise
    .reduce(files, function(memo, fname, i, total) {
        var ffname = fileLocation + '/' + fname;
        return fs
            .readFileAsync(ffname, "utf-8")
            .then(JSON.parse)
            .tap(function(body) {
                if(!_.isUndefined(body.content)) { 
                    debug("file %s, [%s] reason %s, of %s (%d bytes)",
                        ffname, body.error, body.reason, 
                        body.when, _.size(body.content));
                    if(!_.isUndefined(nconf.get("PRINT")))
                        console.log(body.content);
                    memo.push(body.content);
                } else {
                    debug("file %s keys %j", ffname, _.keys(body));
                }
            })
            .catch(function(error) {
                debug("Error with file %s: %s", ffname, error);
            })
            .return(memo);
}, [])
    .tap(function(x) {
        debug(" %d files -- And now the parsing restart," +
              " go to debug in newUserContent", _.size(x));
    })
    .map(function(htmlNode) {
        var tree = cheerio.load(htmlNode);
        debugger;
        fbParserCode.newUserContent(htmlNode);
    });
