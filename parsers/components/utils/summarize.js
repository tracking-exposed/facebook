const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('parsers:components:summarize');
const utils = require('../../../lib/utils');

function picker(metadata, alternative) {
    return  _.reduce(alternative, function(memo, l) {
        if(memo)
            return memo;

        let retv = _.get(metadata, l, null);

        if(retv && (_.size(retv) > 1 || typeof retv == 'object'))
            return retv;
        else {
            // debug("Ignoring metadata [%s] over [%j] because is [%s]", l, alternative, retv);
            return null;
        }
    }, null);
};

function flattenInteractions(memo, interaction) {
    /* amount: '9', desc: '9 Sad', rtype: '7' } */
    switch(interaction.rtype) {
        case '7':
            _.set(memo, 'SAD', interaction.amount);
            break;
        case '1':
            _.set(memo, 'LIKE', interaction.amount);
            break;
        case '4':
            _.set(memo, 'HAHA', interaction.amount);
            break;
        case '2':
            _.set(memo, 'LOVE', interaction.amount);
            break;
        case '8':
            _.set(memo, 'ANGRY', interaction.amount);
            break;
        case '3':
            _.set(memo, 'WOW', interaction.amount);
            break;
        default:
            debugger;
    }
    return memo;
};

function summarize(metadata) {
    /* IGNORED SO FAR ['externalLinks', 'commentsLinks'] */
    const stdFields = ['impressionTime', 'impressionOrder', 'semanticId',
        'postCount', 'semanticCount', 'opengraph', 'id' ];
    let summary = _.pick(metadata, stdFields);

    summary.user = utils.pseudonymize(`user${metadata.userId}`, 3);
    summary.timeline = utils.pseudonymize(`timeline${metadata.timelineId}`, 3);

    metadata.summary = _.extend(_.pick(metadata, [
        'reasons', 'sharer', 'sharedContent',
    ]), { errors: [] });

    summary.publicationTime = picker(metadata, ['feed_id.publicationTime', 'linkontime.publicationTime']);
    summary.postId = picker(metadata, ['feed_id.postId', 'linkontime.postId']);
    summary.permaLink = picker(metadata, ['linkontime.permaLink', 'feed_id.permaLink', 'event.permaLink']);
    summary.fblinktype = picker(metadata, ['linkontime.fblinktype', 'feed_id.fblinktype', 'event.fblinktype']);
    summary.nature = metadata.nature;

    summary.images = metadata.images ? {
        count: typeof metadata.images == 'object' ?  _.size(metadata.images.imageUrls) : 0,
        captions: _.uniq(metadata.images.alt)
    } : { count: 0, captions: [] };

    if(metadata.video)
        summary.videoautoplay = (metadata.video.preload == 'auto');

    let attr = _.find(metadata.attributions, { type: 'authorName' });
    if(attr) {
        summary = _.extend(summary, {
            displaySource: attr.display,
            source: attr.content,
            sourceLink: attr.fblink
        });
    } else {
        debug("Warning: lack of attribution!");
    }

    summary.texts = _.split(metadata.fullText, '\n');
    summary.textsize = _.size(metadata.fullText);

    const adinfo = _.reduce(metadata['data-ad-preview'], function(memo, e) {
        if(['message','headline','link-description'].indexOf(e.info) === -1)
            return memo;
        if(_.size(e.text) > 0)
            memo.push(e.text);
        return memo;
    }, []);

    if(_.size(adinfo))
        summary.texts = _.concat(summary.texts, adinfo);

    summary.texts = _.uniq(summary.texts);

    summary = _.extend(summary, _.reduce(metadata.interactions, flattenInteractions, {}));
    return summary;
};

module.exports = summarize;
