export function scrape (post) {
}

export function identify (elem) {
    if (elem.find('.uiStreamSponsoredLink').length === 1) {
        return 'sponsored';
    } else {
        return 'post';
    }
}

export function scrapeBasicInfo () {
}
