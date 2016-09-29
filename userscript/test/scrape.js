import { assert } from 'chai';
import { loadFixture } from './utils';

import { scrapeBasicInfo, identify, scrapePost } from '../src/scrape';

describe('Scrape', function () {
    it('gets basic info', function () {
        const post = loadFixture('basicInfo');

        assert.deepEqual(scrapeBasicInfo(post), {
            id: '123456789',
            href: 'https://www.facebook.com/giangigino'
        });
    });

    it('parses simple posts', function () {
        assert.deepEqual(scrapePost(loadFixture('post')), {
            postType: 'post',
            fromProfile: 'https://www.facebook.com/agranzot',
            href: '/agranzot/posts/10154575795176552',
            ts: '1475183423'
        });

        assert.deepEqual(scrapePost(loadFixture('post01')), {
            postType: 'post',
            fromProfile: 'https://www.facebook.com/mustardgasandroses/',
            href: '/permalink.php?story_fbid=1132045500176946&id=158503560864483',
            ts: '1475087549'
        });
    });

    it('identifies sponsored posts', function () {
        const post = loadFixture('sponsored');
        assert.equal(identify(post), 'sponsored');
    });
});
