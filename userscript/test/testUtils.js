import { assert } from 'chai';
import { TimeWarp } from './utils';
import { getTimeISO8601 } from '../src/utils';

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
