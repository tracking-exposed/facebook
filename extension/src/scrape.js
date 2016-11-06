import { getTimeISO8601 } from './utils';

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
        console.log('trying', lang, publicTrigger[lang]);
        if (publicTrigger[lang] === sharingLevel) {
            console.log('Language detected: ', lang);
            isPublic = true;
        }
    }

    return {
        visibility: isPublic ? 'public' : 'private',
        impressionTime: getTimeISO8601()
    };
}

export function scrapeUserData (elem) {
    const info = elem.find('.fbxWelcomeBoxName');
    const parsedInfo = {
        // even if the id is a number, I feel more comfortable to cast it to a String
        id: String(JSON.parse(info.attr('data-gt')).bmid),
        href: info.attr('href').split('?')[0]
    };

    return parsedInfo;
}
