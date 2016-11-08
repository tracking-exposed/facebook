import $ from 'jquery';

import { isEmpty, isFunction } from '../utils';

const backend = chrome.storage.local;

function get (key, setIfMissing) {
    return new Promise((resolve, reject) => {
        backend.get(key, val => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else if (isEmpty(val) && !isEmpty(setIfMissing)) {
                var newVal = isFunction(setIfMissing) ? setIfMissing(key) : setIfMissing;
                backend.set(newVal, () => resolve(newVal));
            } else {
                resolve(isEmpty(val[key]) ? null : val[key]);
            }
        });
    });
}

function set (key, value) {
    return new Promise((resolve, reject) => {
        var newVal = {};
        newVal[key] = isFunction(value) ? value(key) : value;
        backend.set(newVal, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(newVal[key]);
            }
        });
    });
}

function update (key, value) {
    return new Promise((resolve, reject) => {
        get(key)
            .then(oldVal => {
                var newVal;
                if (isFunction(value)) {
                    newVal = value(oldVal);
                } else {
                    newVal = $.extend(true, oldVal, value);
                }
                set(key, newVal)
                    .then(val => resolve(val))
                    .catch(error => reject(error));
            })
            .catch(error => reject(error));
    });
};

function remove (key) {
    return new Promise((resolve, reject) => {
        backend.remove(key)
            .then(val => resolve(val))
            .catch(error => reject(error));
    });
};

export default {
    get: get,
    set: set,
    update: update,
    remove: remove
};
