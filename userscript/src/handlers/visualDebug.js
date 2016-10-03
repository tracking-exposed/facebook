function eventHandler (e) {
    e.element.addClass('fbtrex--post-processed');
}

export function register (hub) {
    hub.register('*', eventHandler);
}
