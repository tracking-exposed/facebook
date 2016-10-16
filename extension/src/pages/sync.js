import api from '../api';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('runtime', request, sender);
    if (request.type === 'sync') {
        api
            .postTimeline(request.payload)
            .then(response => sendResponse({type: 'syncResponse', response: response}))
            .catch(error => sendResponse({type: 'syncError', response: error}));
        return true;
    } else {
        sendResponse({error: 'unknown command'});
    }
});
