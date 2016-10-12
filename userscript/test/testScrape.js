import { assert } from 'chai';
import { TimeWarp, listFixtures, loadFixture, loadPayload } from './utils';

import { scrape } from '../src/scrape';

describe('Scrape', function () {
    const fixtures = listFixtures();
    const timeWarp = new TimeWarp();

    afterEach(() => {
        timeWarp.reset();
    });

    fixtures.forEach((path) => {
        const fixture = loadFixture(path);
        const payload = loadPayload(path);

        it(`parses fixture "${path}"`, function () {
            timeWarp.set(2016, 5, 6, 15, 0, 10, -120);
            assert.deepEqual(scrape(fixture), payload);
        });
    });

    it('ignores a post that contains another post', function () {
        timeWarp.set(2016, 5, 6, 15, 0, 10, -120);

        const post0 = loadFixture('postCommentedByFriend').find('.userContentWrapper');
        const post1 = loadFixture('sponsoredPostLikedByFriends').find('.userContentWrapper');

        assert.equal(scrape(post0), null);
        assert.equal(scrape(post1), null);
    });
});
