const _ = require('lodash');
const debug = require('debug')('parsers:components:attribution');

function attributions(envelop, previous) {

    const sources = [ 
        previous.textChains.h2,
        previous.textChains.h3,
        previous.textChains.h4,
        previous.textChains.h5,
        previous.textChains.h6 ];

    let attribution = _.uniq(_.flatten(sources));
    
    const retval = {
        publisherName: _.first(attribution),
        possiblePicks: sources,
    };

    if(_.size(attribution) > 2)
        retval.sharedOf = _.dropRight(attribution);

    return retval;
};

module.exports = attributions;