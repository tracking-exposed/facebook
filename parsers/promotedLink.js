#!/usr/bin/env nodejs
var _ = require('lodash');
var cheerio = require('cheerio');
var moment = require('moment');
var debug = require('debug')('promotedLink');
var parse = require('./lib/parse');
var entities = require('entities');
var nconf = require('nconf'); 

var postcount = 0;
var errorcount = 0;

nconf.set("PARSER_PROMOTEDLINK_VERSION", "201612.01");

function tryPage(elem) {
    try {
        return elem.attr().onmouseover.replace(/.*\"http/, 'http').replace(/\".*/, '').replace(/\\/g, '');
    } catch(error) {
        return null;
    }
}

function getPromotedTitle(snippet) {

	var link;
	var link_type;
	var error = 0;
	var found = false;
	
	var e_threshold;
	var e_linkcontainer;
	var e_ptr;
	
	var re;
	
	if (errorcount > 0)
		return;
	
	postcount ++;
	
    var $ = cheerio.load(snippet.html);
    
    // posted links
    
    if (!found) {
		e_threshold = $('div.userContentWrapper');
		e_linkcontainer = e_threshold.find("div.clearfix");
		e_ptr = e_linkcontainer.find("a.profileLink").parent().next();
   	
		if (e_ptr.attr("href") != undefined)
			found = true;
	}

		
	// videos, posts		
	
	if (!found) {	
		e_threshold = $('div.userContent');
		e_linkcontainer = e_threshold.next().find("div.clearfix");
		if (e_linkcontainer.find("a")[0] !== undefined) {
			e_ptr = e_linkcontainer.find("a").first();
			found = true;
		}
	}

    
    // page link
    
    if (!found) {
		e_threshold = $('div.userContentWrapper');
		e_linkcontainer = e_threshold.find("div.clearfix");
    
		if (e_linkcontainer.find(":first-child").is("a")) {
			e_ptr = e_linkcontainer.find(":first-child");
			found = true;
		}
	}
    	
	// if we have a href element with content in e_ptr then we have a link
	
	if (e_ptr.attr("href") !== "" && e_ptr.attr("href") !== "#") {
		link = e_ptr.attr("href");
		found = true;
	} 
	
	if (!found) {
		debug("#" + postcount + ": link [" + snippet._id + "] NOT FOUND");
		error = 1;
		errorcount++;
	} else {
		debug("#" + postcount + ": link [" + snippet._id + "] : " + link);
	}
	
	if (error == 0)
		return {"postLink": link};

};

return parse.please({
    'name': 'promotedLink', /* this name is the same in parsers-key */
    'requirements': {'postType': 'promoted'},
    'implementation': getPromotedTitle,
    'since': "2016-09-13",
    'until': moment().toISOString(),
});

