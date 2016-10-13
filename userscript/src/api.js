import { HUB } from './hub';
import config from './config';

export function post (apiUrl, data) {
    const payload = JSON.stringify(data);
    const url = config.API_ROOT + apiUrl;

    GM_xmlhttpRequest({
        method: 'POST',
        url: url,
        headers: {
            'Content-Type': 'application/json',
            'X-Fbtrex-Version': config.VERSION,
            'X-Fbtrex-Build': config.BUILD
        },
        data: payload,
        onload: function (response) {
            HUB.event('syncReponse', { url: url, response: response });
        },
        onerror: function (error) {
            // We are parsing the payload because `data` will be modified by the handers/sync.js::sync function.
            HUB.event('syncError', { url: url, data: JSON.parse(payload), error: error});
        }
    });
}

export const postTimeline = post.bind(null, 'timelines');

export const postDOM = post.bind(null, 'dom');
