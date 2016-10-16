function eventHandler (type, e) {
    console.debug(type, e);
}

export function register (hub) {
    hub.register('*', eventHandler);
}
