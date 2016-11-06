// ==UserScript==
// @name         facebook.tracking.exposed
// @namespace    https://facebook.tracking.exposed
// @version      0.9.11
// @description  Collection meta-data from Facebook's timeline, in order to analyze and look for potential informative manipulation (if you've never heard about Filter Bubble, and you're still young⌁inside™, start here https://en.wikipedia.org/wiki/Filter_bubble )
// @author       Claudio Agosti @_vecna
// @match        https://www.facebook.com/*
// @connect      facebook.tracking.exposed
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.1.0/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.13.0/moment.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/lodash-compat/3.10.2/lodash.min.js
// ==/UserScript==

GM_addStyle(`
.escvi--main-button {
  position: fixed;
  bottom: -1px;
  left: 25px;
  display: block;
  width: 350px;
  height: 350px;
  background-color: yellow;
  padding-left: 2em;
  padding-right: 2em;
  color: black;
  font-size: 1.7em;
  text-align: left;
  border: 1px solid #888;
}
`);

var user = null,
    init = false,
    url =  'https://facebook.tracking.exposed',
    version = '0.9.11';

var renderMainButton = function() {
    var mainButton = $("<a />", {
        html: [ '<p>', '<b>', 
                'facebook.tracking.exposed is entering in beta phases.',
                '</b>', '</p>', '<p>',
                'TamperMonkey is not required anymore, and this tool has been replaced by the new version',
                '</p>', '<p>',
                'Press here to see our blogpost about it, ',
                '<b>',
                '<3 and thanks to belong to this network <3',
                '</b>', '</p>', '<small>',
                'Disable this banner via TamperMonkey!',
                '</small>'
               ].join(" "),
        "class": "escvi--main-button",
        href: url + "/beta",
        target: "_blank"
    });
    $('body').append(mainButton);
};

var basicSetup = function() {

    var x = $("div > a");

    _.each(x, function(aElem, cnt) {
        var img = _.get($(aElem)[0], 'firstChild');
        if(!_.isUndefined($(img)[0])) {
            var profile_id = _.get($(img)[0], 'id');
            var pattern = 'profile_pic_header_';
            if (_.startsWith(profile_id, pattern)) {
                user = {
                    id: profile_id.substring(_.size(pattern), _.size(profile_id)),
                    href: aElem.href
                };
            }
        }
    });

    if(_.isNull(user) || _.isUndefined(_.get(user, 'id'))) {
        console.log("Impossible parse the user from " + _.size(x) + " html elements!?");
    } else {
        init = true;
        /* paintLogo */
        console.log("facebook.tracking.exposed initialization: rendering main button, detected user: " + JSON.stringify(user) );
        /* find someone able to implement properly the issue #1 */
        renderMainButton();
    }
};

var justCompatibility = function() {
    if(!init)
        basicSetup();
};

(function() {
    'use strict';
    waitForKeyElements ("div .composerAudienceWrapper", justCompatibility);
    waitForKeyElements (".uiTextareaAutogrow", justCompatibility);
    waitForKeyElements ("div .userContentWrapper", justCompatibility);
})();

/* this code is copied from https://gist.githubusercontent.com/raw/2625891/waitForKeyElements.js found via stackoverflow */

/*--- waitForKeyElements():  A utility function, for Greasemonkey scripts,
    that detects and handles AJAXed content.

    Usage example:

        waitForKeyElements (
            "div.comments"
            , commentCallbackFunction
        );

        //--- Page-specific function to do what we want when the node is found.
        function commentCallbackFunction (jNode) {
            jNode.text ("This comment changed by waitForKeyElements().");
        }

    IMPORTANT: This function requires your script to have loaded jQuery.
*/
function waitForKeyElements (
    selectorTxt,    /* Required: The jQuery selector string that
                        specifies the desired element(s).
                    */
    actionFunction, /* Required: The code to run when elements are
                        found. It is passed a jNode to the matched
                        element.
                    */
    bWaitOnce,      /* Optional: If false, will continue to scan for
                        new elements even after the first match is
                        found.
                    */
    iframeSelector  /* Optional: If set, identifies the iframe to
                        search.
                    */
) {
    var targetNodes, btargetsFound;

    if (typeof iframeSelector == "undefined")
        targetNodes     = $(selectorTxt);
    else
        targetNodes     = $(iframeSelector).contents ()
                                           .find (selectorTxt);

    if (targetNodes  &&  targetNodes.length > 0) {
        btargetsFound   = true;
        /*--- Found target node(s).  Go through each and act if they
            are new.
        */
        targetNodes.each ( function () {
            var jThis        = $(this);
            var alreadyFound = jThis.data ('alreadyFound')  ||  false;

            if (!alreadyFound) {
                //--- Call the payload function.
                var cancelFound     = actionFunction (jThis);
                if (cancelFound)
                    btargetsFound   = false;
                else
                    jThis.data ('alreadyFound', true);
            }
        } );
    }
    else {
        btargetsFound   = false;
    }

    //--- Get the timer-control variable for this selector.
    var controlObj      = waitForKeyElements.controlObj  ||  {};
    var controlKey      = selectorTxt.replace (/[^\w]/g, "_");
    var timeControl     = controlObj [controlKey];

    //--- Now set or clear the timer as appropriate.
    if (btargetsFound  &&  bWaitOnce  &&  timeControl) {
        //--- The only condition where we need to clear the timer.
        clearInterval (timeControl);
        delete controlObj [controlKey];
    }
    else {
        //--- Set a timer, if needed.
        if ( ! timeControl) {
            timeControl = setInterval ( function () {
                    waitForKeyElements (    selectorTxt,
                                            actionFunction,
                                            bWaitOnce,
                                            iframeSelector
                                        );
                },
                300
            );
            controlObj [controlKey] = timeControl;
        }
    }
    waitForKeyElements.controlObj   = controlObj;
}
