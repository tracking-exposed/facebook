import { assert } from 'chai';
import hub from '../src/hub';

describe('Global Hub', function () {
    it('calls handlers on registered events', function () {
        var calledOne = false;
        var calledTwo = false;
        var calledThree = false;

        hub.register('newPost', (type, e) => {
            assert.deepEqual(type, 'newPost');
            assert.deepEqual(e, {'postType': 'sponsored'});
            calledOne = true;
        });

        hub.register('newPost', (type, e) => {
            assert.deepEqual(type, 'newPost');
            assert.deepEqual(e, {'postType': 'sponsored'});
            calledTwo = true;
        });

        hub.register('*', (type, e) => {
            calledThree = true;
        });

        hub.event('newPost', {'postType': 'sponsored'});

        assert.equal(calledOne, true);
        assert.equal(calledTwo, true);
        assert.equal(calledThree, true);

        calledOne = false;
        calledTwo = false;
        calledThree = false;

        hub.event('otherEvent', {'name': 'whatever'});

        assert.equal(calledOne, false);
        assert.equal(calledTwo, false);
        assert.equal(calledThree, true);
    });
});
