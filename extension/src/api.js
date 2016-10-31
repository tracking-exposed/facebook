import config from './config';

function post (apiUrl, sign, data) {
    const xhr = new XMLHttpRequest();
    const payload = JSON.stringify(data);
    const url = config.API_ROOT + apiUrl;

    xhr.open('POST', url, true);

    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-Fbtrex-Version', config.VERSION);
    xhr.setRequestHeader('X-Fbtrex-Build', config.BUILD);

    if (sign) {
        const privateKey = '';
    }

    xhr.send(payload);

    return new Promise((resolve, reject) => {
        xhr.onload = function () {
            if (this.status >= 200 && this.status < 300) {
                resolve(this.response);
            } else {
                reject(this.statusText);
            }
        };

        xhr.onerror = function () {
            reject(this.statusText);
        };
    });
}

const api = {
    postEvents: post.bind(null, true, 'events'),
    register: post.bind(null, false, 'register')
};

export default api;
