import { assert } from 'chai';
import { loadFixture } from './utils';

import { identify } from '../src/scrape';


describe('Scrape', function () {
    it('identifies sponsored posts', function () {
        const post = loadFixture('sponsored');
        assert.equal(identify(post), 'sponsored');
    });
});
