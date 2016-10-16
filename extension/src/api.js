import $ from 'jquery';

import hub from './hub';
import config from './config';

export function post (apiUrl, data) {
    return;
    const payload = JSON.stringify(data);
    const url = config.API_ROOT + apiUrl;

    $.ajax({
        method: 'POST',
        url: url,
        headers: {
            'Content-Type': 'application/json',
            'X-Fbtrex-Version': config.VERSION,
            'X-Fbtrex-Build': config.BUILD
        },
        data: payload
    })
    .done((response) => hub.event('syncReponse', { url: url, response: response }))
    .fail((error) => hub.event('syncError', { url: url, data: JSON.parse(payload), error: error}));
}

export const postTimeline = post.bind(null, 'timelines');

export const postDOM = post.bind(null, 'dom');
