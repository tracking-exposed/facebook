# What's in here?

This directory contains [event
pages](https://developer.chrome.com/extensions/event_pages).

The scripts contained here run on a different permission model that the script
injected in the page. An event page, for example, can do cross-origin
`XMLHttpRequest`s, or tap into some browser internal features (check out the
[Chrome Platform APIs](https://developer.chrome.com/extensions/api_index)).

For now, we will just use
[`XMLHttpRequest`](https://developer.chrome.com/extensions/xhr) and [`chrome
alarms`](https://developer.chrome.com/extensions/alarms).
