// import cheerio from 'cheerio';

import $ from 'jquery';


export function scrape(post) {
}


export function identify(post, parser) {
    if (typeof parser === 'undefined') {
        parser = $;
    }

    var elem = parser(post);
    if (elem.find('.uiStreamSponsoredLink').length == 1) {
        return 'sponsored';
    }
}
