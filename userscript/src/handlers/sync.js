import { postTimeline } from '../api';

const INTERVAL = 60000;

var currentTimeline = null;
var timelines = [];

function handlePost (type, e) {
    e.data.position = currentTimeline.lastPosition++;
    currentTimeline.posts.push(e.data);
}

function handleTimeline (type, e) {
    currentTimeline = {
        uuid: e.uuid,
        dt: e.dt,
        location: window.location.href,
        lastPosition: 1,
        posts: []
    };

    timelines.push(currentTimeline);
}

function sync () {
    // send timelines
    postTimeline(timelines.filter((timeline) => timeline.posts.length));

    // remove all other timelines
    timelines = timelines.slice(timelines.length - 1);

    // empty the "posts" array in currentTimeline
    currentTimeline.posts = [];
}

export function register (hub) {
    hub.register('newPost', handlePost);
    hub.register('newTimeline', handleTimeline);
    hub.register('windowUnload', sync);
    window.setInterval(sync, INTERVAL);
}
