import { getTimeISO8601, getParam } from './utils';

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
    if (!isPublic) {
        console.log(
            "Dilemma: is it 'Private' or in an unrecognized language?",
            sharingLevel);
    }

    return {
        visibility: isPublic ? 'public' : 'private',
        impressionTime: getTimeISO8601()
    };
}

export function scrapeUserData (elem) {
    const href = elem.find('#pagelet_bluebar a[href^="https://www.facebook.com/profile.php"]')
                     .attr('href');

    const parsedInfo = {
        id: getParam('id', href),
        href: href
    };

    return parsedInfo;
}
