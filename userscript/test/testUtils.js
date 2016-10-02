import { assert } from 'chai';
import { currentTimeISO8601 } from '../src/utils';

describe('utils.currentTimeISO8601', function () {
    it('returns the current time', function () {
        const date = new Date(2000, 6, 1, 15, 0, 0, 0);
        date.getTimezoneOffset = function () {
            return -240;
        };
        assert.equal(currentTimeISO8601(date), '2000-07-01T15:00:00+04:00');
    });
});
