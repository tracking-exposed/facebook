var _ = require('lodash');
var debug = require('debug')('sharding');

var MAX_OBJECT_PER_COLUMN = 6;

var estimate = function(columnSize) {
    debug("Starting columns %j", columnSize);
    var max = _.max(_.values(columnSize));
    var shardsNumber = _.parseInt(max / MAX_OBJECT_PER_COLUMN);
    if(max % MAX_OBJECT_PER_COLUMN) shardsNumber += 1;
    debug("From %j columns, %d shards with a max of %d per column", 
        _.keys(columnSize), shardsNumber, MAX_OBJECT_PER_COLUMN);
    return shardsNumber;
};

var minMax = function(numberOf, shardPosition) {
    var shardsNumber = _.parseInt(numberOf / MAX_OBJECT_PER_COLUMN);
    var min = (shardsNumber * shardPosition);

    if(_.lt(numberOf, min)) {
        debug("Ignoring the column with elements %d pos %d cos min is %s",
            numberOf, sharedPosition, min);
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
