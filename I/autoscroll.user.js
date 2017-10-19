// ==UserScript==
// @name         autoscroll
// @namespace    autoscroll
// @version      1.13
// @description  autoscroller to be used with https://facebook.tracking.exposed, This userscript works with TamperMoneky extension.
// @author       Claudio Agosti @_vecna
// @match        https://www.facebook.com/*
// @connect      autoscroll
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdnjs.cloudflare.com/ajax/libs/lodash-compat/3.10.2/lodash.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.13.0/moment.min.js
// ==/UserScript==

var times = 30;
var delay = 5;
var fixedH = 800;
var plan = [
    "08:01",
    "09:01",
    "10:01",
    "11:01",
    "12:01",
    "13:01",
    "14:01",
    "15:01",
    "16:01",
    "17:01",
    "18:01",
    "19:01",
    "20:01",
    "21:01",
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

    if(reference.counter === times) {
        var s = GM_getValue("scrolling");
        console.log("Timeline counter reach", times);
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

        return _.delay(timeline, delay * 1000, reference);
    }
}

function doTheNext() {

    var isNight = moment().hour();
    var subdays = 0;
    if(isNight < 4) {
        console.log("It is night -- (FIXME: this check is not timezone safe)");
        subdays = 1;
    }
    /*
     * This function has to compute the seconds of distance between
     * now and the next TESING-HOUR. the hours are 9:00,11:00 etc,
     * and they happen in GMT-3, (180 minutes, below in the variables)
     */

	var tinfo = _.map(plan, function(t) {

        var GMTARG = 180;
		var hour = _.parseInt(t.split(':')[0]);
		var minute = _.parseInt(t.split(':')[1]);
		var personalO = moment().utcOffset() + GMTARG;
		var target = moment().set({
            hour: hour,
            minute: minute,
            second: 0
        }).utcOffset(GMTARG);
        target.subtract(subdays, 'd');
        var secsdiff = moment.duration(target - moment()).asSeconds();
		var secto =  secsdiff + (personalO * 60);

		return {
            secsdiff: secsdiff,
			hto: _.round(secto / 3600, 1),
			secto: secto,
			target: t,
			x: target.format()
		};
	});

	console.log(tinfo);
	var next = _.first(_.filter(tinfo, function(t) {
		return t.secto > 0;
	}));

    console.log("Schedule computed, next on", next);
    if(!next) {
        console.log("Night problem, check back in 1 hour");
        GM_setValue("refresh", true);
        return _.delay(doTheNext, 3600 * 1000);
    } else {
        console.log("Setting the next timeline to", next.secto);
        GM_setValue("refresh", true);
        return _.delay(cleanAndReload, next.secto * 1000);
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
        console.log("Nope, recorded is", moment(s).format("HH:mm:ss"), "now", moment().format("HH:mm:ss"));

})();


