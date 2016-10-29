import { assert } from 'chai';
import { TimeWarp, listFixtures, loadFixture, loadPayload } from './utils';

import { scrape, scrapeUserData } from '../src/scrape';

describe('Scrape', function () {
    const fixtures = listFixtures('posts/');
    const timeWarp = new TimeWarp();

    afterEach(() => {
        timeWarp.reset();
    });

    fixtures.forEach((path) => {
        const fixture = loadFixture(path);
        // If a payload is missing, the returned value is null.
        const payload = loadPayload(path);

        it(`parses fixture "${path}"`, function () {
            timeWarp.set(2016, 5, 6, 15, 0, 10, -120);
            try {
                var data = scrape(fixture);
                assert.equal(data.visibility, payload.visibility);
            } catch (e) {
                assert.equal(data, payload);
            }
        });
    });

    it('ignores a post that contains another post', function () {
        timeWarp.set(2016, 5, 6, 15, 0, 10, -120);

        const post0 = loadFixture('posts/postCommentedByFriend').find('.userContentWrapper');
        const post1 = loadFixture('posts/sponsoredPostLikedByFriends').find('.userContentWrapper');

        assert.equal(scrape(post0), null);
        assert.equal(scrape(post1), null);
    });

    it('parses basic user info', function () {
        const userInfo = loadFixture('basicInfo');
        const payload = loadPayload('basicInfo');

        assert.deepEqual(scrapeUserData(userInfo), payload);
    });
});
