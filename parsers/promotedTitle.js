#!/usr/bin/env nodejs
var _ = require('lodash');
var cheerio = require('cheerio');
var moment = require('moment');
var debug = require('debug')('promotedTitle');
var parse = require('./lib/parse');
var entities = require('entities');

var postcount = 0;

function tryPage(elem) {
    try {
        return elem.attr().onmouseover.replace(/.*\"http/, 'http').replace(/\".*/, '').replace(/\\/g, '');
    } catch(error) {
        return null;
    }
}

function getPromotedTitle(snippet) {

	var title;
	var title_type;
	var error = 0;
	
	var e_threshold;
	var e_ptr;
		
	postcount ++;
	
    var $ = cheerio.load(snippet.html);
    
	var e_threshold = $('div.userContent');
	
	// original missed p title ObjectId("5838f145c8c8b82a4efe1fe4")
	e_ptr = $(e_threshold).find("p").first();
	if (e_ptr.text() !== "") {
		title = e_ptr.text();
	} else {
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
	}

	if (title === "" || title == undefined) {
		debug("#" + postcount + ": title [" + snippet._id + "] NOT FOUND");
		error = 1;
	} else {
		debug("#" + postcount + ": title [" + snippet._id + "] : " + title);
	}
	
	return {"postTitle": title};

};

return parse.please({
    'name': 'promotedTitle', /* this name is the same in parsers-key */
    'requirements': {'postType': 'promoted'},
    'implementation': getPromotedTitle,
    'since': "2016-09-13",
    'until': moment().toISOString(),
});

