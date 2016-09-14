var _ = require('lodash');
var debug = require('debug')('sharding');

var MAX_OBJECT_PER_COLUMN = 300;

var estimate = function(columnSize) {
    var max = _.max(_.values(columnSize));
    var shardsNumber = _.parseInt(max / MAX_OBJECT_PER_COLUMN);

    if(max % MAX_OBJECT_PER_COLUMN)
        shardsNumber += 1;

    return shardsNumber;
};

var minMax = function(numberOf, shardPosition) {

    var min = (MAX_OBJECT_PER_COLUMN * shardPosition);

    if(_.lt(numberOf, min)) {
        debug("Ignoring the column with elements %d shard #%d cos min is %s",
            numberOf, shardPosition, min);
        return null;
    }
    return {
        'min': min,
        'max': min + MAX_OBJECT_PER_COLUMN
    };
};

module.exports = {
    estimate: estimate,
    minMax: minMax,
    maxElements: MAX_OBJECT_PER_COLUMN
};
