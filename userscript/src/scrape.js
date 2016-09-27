export function scrape (post) {
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
        id: JSON.parse(info.attr('data-gt')).bmid,
        href: info.attr('href').split('?')[0]
    };

    return parsedInfo;
}
