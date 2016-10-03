import { assert } from 'chai';
import { HUB } from '../src/hub';

describe('Global Hub', function () {
    it('calls handlers on registered events', function () {
        var calledOne = false;
        var calledTwo = false;
        var calledThree = false;

        HUB.register('newPost', (e) => {
            assert.deepEqual(e, {'type': 'sponsored'});
            calledOne = true;
        });

        HUB.register('newPost', (e) => {
            assert.deepEqual(e, {'type': 'sponsored'});
            calledTwo = true;
        });

        HUB.register('*', (e) => {
            calledThree = true;
        });

        HUB.event('newPost', {'type': 'sponsored'});

        assert.equal(calledOne, true);
        assert.equal(calledTwo, true);
        assert.equal(calledThree, true);

        calledOne = false;
        calledTwo = false;
        calledThree = false;

        HUB.event('otherEvent', {'name': 'whatever'});

        assert.equal(calledOne, false);
        assert.equal(calledTwo, false);
        assert.equal(calledThree, true);
    });
});
