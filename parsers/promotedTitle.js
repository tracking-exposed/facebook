#!/usr/bin/env node
var _ = require('lodash');
var cheerio = require('cheerio');
var moment = require('moment');
var debug = require('debug')('parser:promotedTitle');
var parse = require('./lib/parse');
var utils = require('../lib/utils');
var entities = require('entities');
var nconf = require('nconf'); 

var postcount = 0;
var errorcount = 0;

nconf.set("PARSER_PROMOTEDTITLE_VERSION", "201612.03");

function getPromotedTitle(snippet) {

	var title;
	var title_type;
	var found = false;
	
	var e_threshold;
	var e_ptr;
		
	postcount ++;
	
    var $ = cheerio.load(snippet.html);
    
	var e_threshold = $('div.userContent');
	
	// original missed p title ObjectId("5838f145c8c8b82a4efe1fe4")
	e_ptr = $(e_threshold).find("p").first();
	if (e_ptr.text() !== "") {
		title = e_ptr.text();
		found = true;
	} else {
		e_ptr = $(e_threshold).next().find(".clearfix").first();
		e_ptr.children("div").each(function() {
			if (!$(this).find("button")[0]) {
				if ($(this).children().first().text() === entities.decodeHTML($(this).children().first().html()) && $(this).children().first().text() !== "") {
					title = $(this).children().first().text();
					found = true;
				}
			}
		});
	}

	if (!found) {
		errorcount++;
        debug("Err %d post %d [%s] Title NOT FOUND", errorcount, postcount, snippet.id);
        return { "promotedTitle": false };
	} else {
		debug("Err %d post %d [%s] Title: %s", errorcount, postcount, snippet.id, title);
	    return { 
            "promotedTitle": true,
            "title": title,
            "titleId": utils.hash({'title': title}) 
        };
	}
};

return parse.please({
    'name': 'promotedTitle', /* this name is the same in parsers-key */
    'requirements': {'type': 'promoted'},
    'implementation': getPromotedTitle,
    'since': "2016-09-13",
    'until': moment().toISOString(),
});

