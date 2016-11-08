import api from './api';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'sync') {
        api
            .postEvents(request.payload, request.userId)
            .then(response => sendResponse({type: 'syncResponse', response: response}))
            .catch(error => sendResponse({type: 'syncError', response: error}));
        return true;
    }
});
