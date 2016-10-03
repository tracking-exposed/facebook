export function registerHandlers (hub) {
    require('./logger').register(hub);
    require('./visualDebug').register(hub);
}
