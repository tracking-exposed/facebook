import { isEmpty } from '../utils';

export function get (key, setIfMissing) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(userId, (record) => {
            if (isEmpty(record)) {
                if (isFunction(setIfMissing)) {

                }
            }
        });
    })
}

export function set (key, value) {
    return new Promise((resolve, reject) => {
    })
}

export function update (key, value) {
    return new Promise((resolve, reject) => {
    })
}

export function delete (key) {

}
