import nacl from 'tweetnacl';
import bs58 from 'bs58';

import api from '../api';
import { isEmpty } from '../utils';
import { get, set, update } from './db';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'userLookup') {
        userLookup(request.payload, sendResponse);

        // Make the call asynchronous.
        return true;
    } else if (request.type === 'userVerify') {
        userVerify(request.payload, sendResponse);

        // Make the call asynchronous.
        return true;
    }
});

function userLookup ({ userId }, sendResponse) {
    get(userId).then(val => {
        if (isEmpty(val)) {
            var newKeypair = nacl.box.keyPair();
            val = {
                publicKey: bs58.encode(newKeypair.publicKey),
                secretKey: bs58.encode(newKeypair.secretKey),
                status: 'new'
            };
            set(userId, val).then(val => {
                sendResponse({ publicKey: val.publicKey, status: val.status });
            });
        } else {
            sendResponse({ publicKey: val.publicKey, status: val.status });
        }
    });
};

function userVerify ({ permalink, publicKey, userId }, sendResponse) {
    api.validate({ permalink, publicKey })
        .catch/* 'then' */(response => {
            update(userId, { status: 'verified' })
                .then(response => sendResponse('ok'))
                .catch(response => sendResponse('ok'/* 'error' */));
        });
        // .catch(response => sendResponse('error'));
};
