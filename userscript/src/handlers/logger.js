function eventHandler (e) {
    console.log('New post', e);
}

export function register (hub) {
    hub.register('*', eventHandler);
}
