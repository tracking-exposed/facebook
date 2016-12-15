#!/usr/bin/env nodejs
var _ = require('lodash');
var cheerio = require('cheerio');
var moment = require('moment');
var debug = require('debug')('promotedTitle');
var parse = require('./lib/parse');
var entities = require('entities');

var postcount = 0;
var error = 0;

function getPromotedTitle(snippet) {

	var title;
	var title_type;
	
	var e_threshold;
	var e_ptr;
		
	postcount ++;
	
    var $ = cheerio.load(snippet.html);
    
	var e_threshold = $('div.userContent');

	e_ptr = ($(e_threshold).next().find(".clearfix"));
	$(e_ptr).find("*").each(function(e) {
		if (title == undefined) {
			var re = /(div|a|span)/g;
			if (re.exec($(this)[0].name) != null) {
				if ($(this).text() === entities.decodeHTML($(this).first().html()) && $(this).text() !== "") {
					if ($(this).text() !== "Click for more") {
						title = $(this).text();
					}
				}
			}
		}
	});


	if ( _.size(title) === 0 || !title ) {
		error ++;
		debug("Err %d post %d [%s] Title NOT FOUND", error, postcount, snippet.id);
	    return {"promotedTitle": false};
	} else {
		debug("Err %d post %d [%s] Title: %s", error, postcount, snippet.id, title);
	    return {"promotedTitle": title};
	}
};

return parse.please({
    'name': 'promotedTitle', /* this name is the same in parsers-key */
    'requirements': {'postType': 'promoted'},
    'implementation': getPromotedTitle,
    'since': "2016-09-13",
    'until': moment().toISOString(),
});

