const INTERVAL = 1000;
const posts = [];
var lastCheck = null;

function eventHandler (type, e) {
    posts.push(e);
}

function sync () {

}

export function register (hub) {
    hub.register('newPost', eventHandler);
}
