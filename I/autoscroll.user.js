// ==UserScript==
// @name         autoscroll
// @namespace    autoscroll
// @version      1.4
// @description  autoscroller to be used with https://facebook.tracking.exposed, This userscript works with TamperMoneky extension.
// @author       Claudio Agosti @_vecna
// @match        https://www.facebook.com/*
// @connect      autoscroll
// ==/UserScript==

var whereScroll = 0;
var refreshTimes = 1;
var height = 800;

/* Timings below */
var scrollDelay = 2000;
var maxScrollTimes = 2 /* minutes */ * 60 /* seconds */ * 1000 /* milliseconds */ / scrollDelay ;
var bigStop = (58 * 60 * 1000); 
// 2 hours : 58 minutes, one scroll every 3 hours, 8 scroll x day.

var scrollDown = function() {
    whereScroll = ( (height * refreshTimes) + 100);
    
    refreshTimes += 1;
    if(refreshTimes == maxScrollTimes ) {
        console.log("Big stop now!");
        setTimeout(scrollDown, bigStop);
    } else if (refreshTimes > maxScrollTimes ) {
        location.reload();
    } else {
        console.log("Autoscroll: scroll to " + whereScroll + " next will happen in: " + scrollDelay + " ms");
        scrollTo(0, whereScroll);
        setTimeout(scrollDown, scrollDelay);
    }
};

(function() {
    'use strict';
    console.log("Numbers: bigStop", bigStop, "after", maxScrollTimes, "scrolls, happening once every", scrollDelay);
    setTimeout (scrollDown, scrollDelay);
})();
