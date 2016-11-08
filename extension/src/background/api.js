import nacl from 'tweetnacl';
import bs58 from 'bs58';

import config from '../config';
import { decodeString, decodeKey } from '../utils';
import db from './db';

function post (apiUrl, data, userId) {
    return new Promise((resolve, reject) => {
        db.get(userId).then(keypair => {
            const xhr = new XMLHttpRequest();
            const payload = JSON.stringify(data);
            const url = config.API_ROOT + apiUrl;

            xhr.open('POST', url, true);

            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('X-Fbtrex-Version', config.VERSION);
            xhr.setRequestHeader('X-Fbtrex-Build', config.BUILD);

            if (userId) {
                if (!keypair) {
                    reject('Cannot sign payload, no keypair found!');
                    return;
                }

                const signature = nacl.sign.detached(decodeString(payload),
                                                     decodeKey(keypair.secretKey));

                xhr.setRequestHeader('X-Fbtrex-UserId', userId);
                xhr.setRequestHeader('X-Fbtrex-PublicKey', keypair.publicKey);
                xhr.setRequestHeader('X-Fbtrex-Signature', bs58.encode(signature));
            }

            xhr.send(payload);
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
        })
        .catch(error => reject(error));
    });
}

const api = {
    postEvents: post.bind(null, 'events'),
    validate: post.bind(null, 'validate')
};

export default api;
