import { assert } from 'chai';
import { $, loadFixture } from './utils';

import { scrapeBasicInfo, identify } from '../src/scrape';

describe('Scrape', function () {
    it('gets basic info', function () {
        const post = loadFixture('basicInfo');
        const parsedInfo = scrapeBasicInfo($(post));
        assert.equal(parsedInfo.id, '123456789');
        assert.equal(parsedInfo.href, 'https://www.facebook.com/giangigino');
    });

    it('identifies simple posts', function () {
        const post = loadFixture('post');
        assert.equal(identify($(post)), 'post');
    });

    it('identifies sponsored posts', function () {
        const post = loadFixture('sponsored');
        assert.equal(identify($(post)), 'sponsored');
    });
});
