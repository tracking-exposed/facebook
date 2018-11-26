var _ = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('lib:parse');
var moment = require('moment');
var nconf = require('nconf'); 

var mongo = require('./mongo');
nconf.argv().env().file({ file: "config/collector.json" });

var components = require('../parsers/components');


function initialize(impression) {

    var jsdom = require("jsdom");
    var { JSDOM } = jsdom;

    if(_.isUndefined(impression.id)) {
        debug("Error: invalid impression!");
        return null;
    }

    return mongo
        .read(nconf.get('schema').metadata, { id: impression.id })
        .then(function(i) {
            if(i.id === impression.id) {
                if(!nconf.get('repeat')) {
                    debug("metadata [%s] already exists, skipping", i.id);
                    return null;
                } else
                    debug("metadata [%s] exists, repeat is allowed", i.id);
            }

            var dom = new JSDOM(impression.html); 
            return {
                impression: impression,
                dom: dom.window.document
            };
        });
}

function save(metadata) {
    console.log("I should save metadata and do statistics on the results");
} 

function impression(input) {

    return initialize(input)
        .then(components.promoted)
        .then(components.post)
        .then(components.text);

};

module.exports = {
    impression: impression,
    save: save
}

