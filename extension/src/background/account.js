import nacl from 'tweetnacl';
import bs58 from 'bs58';

import api from '../api';
import { isEmpty } from '../utils';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'userLookup') {
        lookupUser(request.payload, sendResponse);

        // Make the call asynchronous.
        return true;
    } else if (request.type === 'userRegistration') {
        registerUser(request.payload, sendResponse);

        // Make the call asynchronous.
        return true;
    }
});

function lookupUser ({ userId }, sendResponse) {
    chrome.storage.sync.get(userId, (record) => {
        if (isEmpty(record)) {
            var newKeypair = nacl.box.keyPair();
            record[userId] = {
                publicKey: bs58.encode(newKeypair.publicKey),
                secretKey: bs58.encode(newKeypair.secretKey),
                status: 'new'
            };
            chrome.storage.sync.set(record);
        }

        var keypair = record[userId];

        sendResponse({ publicKey: keypair.publicKey, status: keypair.status, isNew: true });
    });
};

function registerUser ({ permalink, publicKey }, sendResponse) {
    api
        .register({ permalink, publicKey })
        .then(response => sendResponse('ok'))
        .error(response => sendResponse('error'));
};
