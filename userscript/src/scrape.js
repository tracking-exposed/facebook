import cheerio from 'cheerio';


export function scrape(post) {
}


export function identify(post) {
    var $ = cheerio.load(post);
    if ($('.uiStreamSponsoredLink').length == 1) {
        return 'sponsored';
    }
}
