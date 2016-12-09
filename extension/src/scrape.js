import cookie from 'cookie';

import { getTimeISO8601, getParam, normalizeUrl } from './utils';

export function scrape (elem) {
    const postType = (elem.find('.uiStreamSponsoredLink').length === 1) ? 'sponsored' : 'feed';
    return scrapePost(postType, elem);
}

var publicTrigger = {
    'english': 'Public',
    'deutsch': 'Öffentlich',
    'espanol': 'Público',
    'italiano': 'Tutti',
    'português': 'Público'
};

export function scrapePost (postType, elem) {
    // Skip if the post is not top level
    if (elem.parents('.userContentWrapper').length) {
        console.log('Skipping post because nested');
        return null;
    }

    var isPublic = false;

    var sharingLevel = elem
      .find('[data-hover="tooltip"][role][aria-label][data-tooltip-content]')
      .attr('aria-label')
      .split(':')
      .pop()
      .trim();

    for (var lang in publicTrigger) {
        if (publicTrigger[lang] === sharingLevel) {
            isPublic = true;
        }
    }

    return {
        visibility: isPublic ? 'public' : 'private',
        visibilityInfo: sharingLevel,
        impressionTime: getTimeISO8601()
    };
}

export function scrapeUserData () {
    const id = cookie.parse(document.cookie).c_user;

    const parsedInfo = {
        id: id,
        href: `https://www.facebook.com/profile.php?id=${id}`
    };

    return parsedInfo;
}

export function scrapePermalink (elem) {
    // If the user doesn't have a vanity URL, then the link to the post will
    // start with `permalink.php...`. If the user **has** a vanity URL, then the
    // link will be `<username>/posts/...`.
    var permalink = elem.find('[href^="/permalink.php"]').attr('href') ||
                    elem.find('[href*="/posts/"]').attr('href');
    return normalizeUrl(permalink);
}
