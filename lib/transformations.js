const _ = require('lodash');

function metadataToSimple(metadata) {
    const omitf = ['_id', 'when', 'userId', 'savingTime', 'paadc', 'images', 'hrefs', 'meaningfulId', 'nature', 'texts'];
    metadata = _.extend(metadata, metadata.nature);
    metadata.pics = _.size(metadata.images);
    metadata.links = _.size(metadata.htmls);
    metadata.infos = _.size(metadata.meaningfulId);
    metadata.textContent = metadata.texts.join("<+>");
    metadata.textSize = _.size(metadata.texts.join(""));
    return _.omit(metadata, omitf);
}

module.exports = {
    metadataToSimple,
}
