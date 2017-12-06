// ==UserScript==
// @name         autoscroll
// @namespace    autoscroll
// @version      1.16
// @description  autoscroller to be used with https://facebook.tracking.exposed, This userscript works with TamperMoneky extension.
// @author       Claudio Agosti @_vecna
// @match        https://www.facebook.com/*
// @connect      autoscroll
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdnjs.cloudflare.com/ajax/libs/lodash-compat/3.10.2/lodash.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.13.0/moment.min.js
// ==/UserScript==

var SCROLL_TIMES = 30;
var AWAITSECS = 5;
var fixedH = 800;

var plan = [
    "08:01",
    "16:01",
    "23:55"
];

function timeline(reference) {

    if(!reference) {
        var s = GM_getValue("scrolling");

        if(s && moment(s).add(50, 's').isBefore(moment())) {
            console.log("a previous scroll interrupted?");
        }

        if(s && moment(s).add(50, 's').isAfter(moment())) {
            return;
        }

        console.log("setting GM_setValue 'scrolling'", moment().format() );
        GM_setValue("scrolling", moment().format());

        reference = {
            counter: 0,
            y: 0,
        };
    }

    if(reference.counter === SCROLL_TIMES) {
        var s = GM_getValue("scrolling");
        console.log("Timeline counter reach", SCROLL_TIMES);
        if(s) {
            console.log(s, "'scrolling': is present, -> doTheNext, removing GM_[scrolling]", s);
            GM_setValue("scrolling", null);
            return _.delay(doTheNext, 1);
        } else {
            console.log("GM_[scrolling] is null", s, "killed ramification");
        }
    } else {
        reference.counter += 1;
        reference.y = reference.counter * fixedH;
        GM_setValue("scrolling", moment().format());

        console.log("scrolling", reference.counter, "at",
                  moment().format("HH:mm:ss"), "a the Y", reference.y);

        scrollTo(0, reference.y);

        return _.delay(timeline, AWAITSECS * 1000, reference);
    }
}

function doTheNext() {

    /* this is not anymore timezone robust, it is intended to be run in the right place */
    var next = null;
    _.each(plan, function(t) {

		var hour = _.parseInt(t.split(':')[0]);
		var minute = _.parseInt(t.split(':')[1]);

        var target = moment().startOf('day').add(hour, 'h').add(minute, 'm');

        if(!next && moment().isBefore( target ) ) {
            console.log("The next refresh will be at", t);
            next = moment.duration(target - moment()).asSeconds();
        }
    });

    if(!next) {
        console.log("strange condition before midnight, check in 1 hour");
        GM_setValue("refresh", true);
        return _.delay(doTheNext, 3600 * 1000);
    } else {
        console.log("Setting the next timeline in", next, "seconds");
        GM_setValue("refresh", true);
        return _.delay(cleanAndReload, next * 1000);
    }
};

function cleanAndReload() {
    GM_setValue("scrolling", null);
    // this value 'refresh' is not used because remain dirty in case a browser restart
    GM_setValue("refresh", null);
    location.reload();
};

(function() {

    var s = GM_getValue("scrolling");

    if( s && moment(s).add(50, 's').isBefore(moment())) {
        console.log("Considering the diff of", 
                moment.duration(moment() - moment(s)).humanize(), "...");
        timeline();
    }
    else if(!s) {
        var r = GM_getValue("refresh");
        console.log("beginning tampermonkey, scrolling", s, "refresh", r);
        timeline();
    } else
        console.log("Nope, recorded is", moment(s).format("HH:mm:ss"), "now is:", moment().format("HH:mm:ss"));
})();
