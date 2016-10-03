import { assert } from 'chai';
import { TimeWarp, loadFixture } from './utils';

import { scrapeBasicInfo, identify, scrapePost } from '../src/scrape';

describe('Scrape', function () {
    const timeWarp = new TimeWarp();

    afterEach(() => {
        timeWarp.reset();
    });

    it('gets basic info', function () {
        const post = loadFixture('basicInfo');

        assert.deepEqual(scrapeBasicInfo(post), {
            id: '123456789',
            href: 'https://www.facebook.com/giangigino'
        });
    });

    it('parses simple posts', function () {
        timeWarp.set(2016, 5, 6, 15, 0, 10, -120);

        assert.deepEqual(scrapePost(loadFixture('post')), {
            postType: 'post',
            fromProfile: 'https://www.facebook.com/agranzot',
            href: 'https://www.facebook.com/agranzot/posts/10154575795176552',
            ts: '1475183423',
            seenAt: '2016-06-06T15:00:10+02:00'
        });

        timeWarp.set(2016, 9, 15, 4, 20, 0, 60);

        assert.deepEqual(scrapePost(loadFixture('post01')), {
            postType: 'post',
            fromProfile: 'https://www.facebook.com/mustardgasandroses/',
            href: 'https://www.facebook.com/permalink.php?story_fbid=1132045500176946&id=158503560864483',
            ts: '1475087549',
            seenAt: '2016-10-15T04:20:00-01:00'
        });
    });

    it('identifies sponsored posts', function () {
        const post = loadFixture('sponsored');
        assert.equal(identify(post), 'sponsored');
    });
});
