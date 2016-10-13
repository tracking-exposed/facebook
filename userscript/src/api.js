import { HUB } from './hub';
import config from './config';

export function post (apiUrl, data) {
    const payload = JSON.stringify(data);

    GM_xmlhttpRequest({
        method: 'POST',
        url: config.API_ROOT + apiUrl,
        headers: {
            'Content-Type': 'application/json',
            'X-Fbtrex-Version': config.VERSION,
            'X-Fbtrex-Build': config.BUILD
        },
        data: payload,
        onload: function (response) {
            HUB.event('syncReponse', response);
        }
    });
}

export const postTimeline = post.bind(null, 'timelines');

export const postDOM = post.bind(null, 'dom');
