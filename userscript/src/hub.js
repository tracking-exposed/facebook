class Hub {
    constructor () {
        this.handlers = {};
    }

    register (eventName, handler) {
        if (!this.handlers[eventName]) {
            this.handlers[eventName] = [];
        }
        this.handlers[eventName].push(handler);
    }

    event (eventName, payload) {
        const funcs = this.handlers[eventName];
        const funcsStar = this.handlers['*'];
        if (funcs) {
            funcs.forEach((func) => func(payload));
        }

        if (funcsStar) {
            funcsStar.forEach((func) => func(payload));
        }
    }
}

export const HUB = new Hub();
