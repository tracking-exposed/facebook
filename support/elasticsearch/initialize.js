#!/usr/bin/env node
const Promise = require('bluebird');
const request = Promise.promisifyAll(require('request'));
const nconf = require('nconf');
const _ = require('lodash');
const debug = require('debug')('support:elasticsearch:initialize');
const querystring = require('querystring');

const various = require('../../lib/various');

nconf.argv().env().file({ file: "config/collector.json" });

if(!nconf.get('server') || !nconf.get('name'))
    return console.log('--server and --name required');

const name = nconf.get('name');
const environment = nconf.get("FBTREX_ENV") || "development"
const fname = 'support/elasticsearch/' + name + '.json';
debug("Initializeding with name %s, looking for %s", name, fname);
const endPointName = 'http://' + nconf.get('server') + '/' + name+"."+environment;

return various.loadJSONfile(fname)
	.then(function(content) {
        console.log(JSON.stringify(content, undefined, 2));
		debug("Connecting to %s", endPointName);
		return request
            .putAsync({
                url: endPointName,
		headers: {
			'Content-Type': 'application/json'
	        },
                body: JSON.stringify(content)
            });
    })
    .then(function(posted) {
        debug("index posted: %s", JSON.stringify(posted, undefined, 2));
    });
