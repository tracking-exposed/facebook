import config from '../config';
import { postTimeline } from '../api';

const INTERVAL = config.FLUSH_INTERVAL;
var user = null;

var currentTimeline = null;
var timelines = [];

function handleUser (type, e) {
    console.log('user', e);
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

function sync () {
    // send timelines
    postTimeline(timelines.filter((timeline) => timeline.posts.length));

    // remove all other timelines
    timelines = timelines.slice(timelines.length - 1);

    // empty the "posts" array in currentTimeline
    currentTimeline.posts = [];
}

export function register (hub) {
    hub.register('user', handleUser);
    hub.register('newPost', handlePost);
    hub.register('newTimeline', handleTimeline);
    hub.register('windowUnload', sync);
    window.setInterval(sync, INTERVAL);
}
