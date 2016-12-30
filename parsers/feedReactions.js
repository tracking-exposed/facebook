#!/usr/bin/env nodejs
var _ = require('lodash');
var cheerio = require('cheerio');
var moment = require('moment');
var debug = require('debug')('feedReactions');
var parse = require('./lib/parse');
var entities = require('entities');
var nconf = require('nconf'); 

var postcount = 0;
var errorcount = 0;
	
nconf.set("PARSER_FEEDREACTIONS_VERSION", "201612.01");

function getFeedReactions(snippet) {

	var reactions = {"_total": 0, "_total_simple": 0};
    var found = false;
	
	var e_threshold;
	var e_container;
	var e_ptr;
	
	postcount ++;
	
    var $ = cheerio.load(snippet.html);
    
    // comment
    e_threshold = $('div[data-reactroot] div._ipo');
    e_threshold.find("a[aria-live]").each(function() {
		if ($(this).attr("aria-live") === "polite") {
			if (/comment/.exec($(this).attr("data-tooltip-uri"))) {
				var data = $(this).text().split(" ");
                debugger;
				reactions.comments = data[0];
				reactions._total += parseInt(data[0]);
                found = true;
			}
		}
	});
    
    // likes etc
    e_threshold = $('div[data-reactroot] div._ipp');
    e_threshold.find("a[aria-label]").each(function() {
		var data = $(this).attr("aria-label").split(" ");
                debugger;
		reactions[data[1].toLowerCase()] = data[0];
		reactions._total += parseInt(data[0]);
		reactions._total_simple += parseInt(data[0]);
		found = true;
	});
	
	if (!found) {
		debug("#" + postcount + ": reactions [" + snippet._id + "] NOT FOUND");
		error = 1;
		errorcount++;
        return { 'feedReactions': false };
	} else {
		debug("#" + postcount + ": reactions [" + snippet._id + "] : " + JSON.stringify(reactions, undefined, 2));
        return { 'reactions': reactions,
                 'feedReactions': true };
        }
	}
	
};

return parse.please({
    'name': 'feedReactions', /* this name is the same in parsers-key */
    'requirements': {'type': 'feed'},
    'implementation': getFeedReactions,
    'since': "2016-09-13",
    'until': moment().toISOString(),
});

