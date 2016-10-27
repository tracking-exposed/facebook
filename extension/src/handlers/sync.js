import config from '../config';

const INTERVAL = config.FLUSH_INTERVAL;

var state = {
    user: null,
    timeline: null,
    position: 1,
    events: []
};

function handleUser (type, e) {
    state.user = e;
}

function handlePost (type, e) {
    var post = Object.assign({
        position: state.position++,
        timelineId: state.timeline.timelineId
    }, e.data);

    state.events.push(post);
}

function handleTimeline (type, e) {
    state.position = 1;
    state.timeline = {
        id: e.id,
        dt: e.dt,
        type: 'timeline',
        fromProfile: state.user.id,
        location: window.location.href
    };

    state.events.push(state.timeline);
}

function sync (hub) {
    if (state.events.length) {
        // Send timelines to the page handling the communication with the API.
        // This might be refactored using something compatible to the HUB architecture.
        chrome.runtime.sendMessage({type: 'sync', payload: state.events},
                                   (response) => hub.event('syncResponse', response));

        state.events = [];
    }
}

export function register (hub) {
    hub.register('user', handleUser);
    hub.register('newPost', handlePost);
    hub.register('newTimeline', handleTimeline);
    hub.register('windowUnload', sync.bind(null, hub));
    window.setInterval(sync.bind(null, hub), INTERVAL);
}
