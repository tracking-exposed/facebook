export function registerHandlers (hub) {
    require('./sync').register(hub);
    require('./logger').register(hub);
    require('./visualDebug').register(hub);
}
