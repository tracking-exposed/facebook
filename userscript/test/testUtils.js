import { assert } from 'chai';
import { TimeWarp } from './utils';
import { getTimeISO8601, normalizeUrl } from '../src/utils';

describe('utils.getTimeISO8601', function () {
    const timeWarp = new TimeWarp();

    afterEach(() => {
        timeWarp.reset();
    });

    it('returns the current time if no args', function () {
        timeWarp.set(2001, 11, 10, 6, 30, 30, -240);
        assert.equal(getTimeISO8601(), '2001-12-10T06:30:30+04:00');
    });

    it('converts a Date instance to ISO8601', function () {
        const date = new Date(2000, 6, 1, 15, 0, 0, 0);
        date.getTimezoneOffset = () => -60;

        assert.equal(getTimeISO8601(date), '2000-07-01T15:00:00+01:00');
    });
});

describe('utils.normalizeUrl', function () {
    it('adds the root to static paths', function () {
        assert.equal(normalizeUrl('/foo/bar'), 'https://www.facebook.com/foo/bar');
    });

    it('doesn\'t add the root if already present', function () {
        assert.equal(normalizeUrl('https://www.facebook.com/foo/bar'), 'https://www.facebook.com/foo/bar');
    });

    it('accepts null/undefined urls and returns null', function () {
        assert.equal(normalizeUrl(), null);
    });
});
