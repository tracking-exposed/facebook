import config from '../config';

const INTERVAL = config.FLUSH_INTERVAL;
var user = null;

var currentTimeline = null;
var timelines = [];

function handleUser (type, e) {
    user = e;
}

function handlePost (type, e) {
    e.data.position = currentTimeline.lastPosition++;
    currentTimeline.posts.push(e.data);
}

function handleTimeline (type, e) {
    currentTimeline = {
        fromProfile: user.id,
        uuid: e.uuid,
        dt: e.dt,
        location: window.location.href,
        lastPosition: 1,
        posts: []
    };

    timelines.push(currentTimeline);
}

function sync (hub) {
    const elements = timelines.filter((timeline) => timeline.posts.length);

    if (elements.length) {
        // Send timelines to the page handling the communication with the API.
        // This might be refactored using something compatible to the HUB architecture.
        chrome.runtime.sendMessage({type: 'sync', payload: elements},
                                   (response) => hub.event('syncResponse', response));

        // remove all other timelines
        timelines = timelines.slice(timelines.length - 1);

        // empty the "posts" array in currentTimeline
        currentTimeline.posts = [];
    }
}

export function register (hub) {
    hub.register('user', handleUser);
    hub.register('newPost', handlePost);
    hub.register('newTimeline', handleTimeline);
    hub.register('windowUnload', sync.bind(null, hub));
    window.setInterval(sync.bind(null, hub), INTERVAL);
}
