import { getTimeISO8601, normalizeUrl } from './utils';

export function scrapePost (elem) {
    const postType = identify(elem);

    console.log(elem.find('.userContentWrapper').length);
    if (elem.find('.userContentWrapper .userContentWrapper').length) {
        console.log('return');
        return null;
    }

    const fromProfile = elem.find('[data-hovercard^="/ajax/hovercard/user.php"]');

    return {
        postType: postType,
        fromProfile: elem.find('.profileLink').attr('href'),
        href: normalizeUrl(elem.find('.fsm a').attr('href')),
        ts: elem.find('.fsm abbr').attr('data-utime'),
        seenAt: getTimeISO8601()
    };
}

export function identify (elem) {
    if (elem.find('.uiStreamSponsoredLink').length === 1) {
        return 'sponsored';
    } else {
        return 'post';
    }
}

export function scrapeBasicInfo (elem) {
    const info = elem.find('.fbxWelcomeBoxName');
    const parsedInfo = {
        // even if the id is a number, I feel more comfortable to cast it to a String
        id: String(JSON.parse(info.attr('data-gt')).bmid),
        href: info.attr('href').split('?')[0]
    };

    return parsedInfo;
}
