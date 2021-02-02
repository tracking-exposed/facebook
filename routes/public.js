const _ = require('lodash');
const debug = require('debug')('routes:public');
const nconf = require('nconf');
const moment = require('moment');

const mongo3 = require('../lib/mongo3');

function buildFilter(weekn) {
    const startISO = moment("2020-12-28").add(weekn, 'week');
    const endISO = moment("2020-12-28").add(weekn + 1, 'week');

    return filter = {
        "nature.kind": 'ad',
        impressionTime: { "$gte": new Date(startISO), "$lte": new Date(endISO)}
    };
}

const LIMIT = 50000;
async function getData(filter) {
    const mongodriver = await mongo3.clientConnect({concurrency: 1});
    /* publisher, text, link-to-image,
        savingTime, timelineId, impressionOrder, semanticID) */
    const content = await mongo3.readLimit(mongodriver, nconf.get('schema').metadata,
        filter, { impressionTime: -1 }, LIMIT, 0
    );
    debug("Returning from DB advertising %d elements (filtered as %j",
        _.size(content), filter);
    await mongodriver.close();
    return content;
}

async function ad(req) {
    const weekn = _.parseInt(req.params.weekn);
    const currentAsW = _.parseInt(
        _.round( moment.duration (  moment() - moment("2020-12-28") ) .asWeeks(), 1)
         .toString());

    if(_.isNaN(weekn)) {
        return {
            text: "This URL need a parameter specifing the week number — Current week need: /api/v2/ad/" + currentAsW
        }
    }
    if(currentAsW >= 52) {
        return {
            text: "This tool is supposed to be used only in 2021"
        }
    }

    const currentNextW = currentAsW + 1;
    debug("accessing to look for ad weekn %d (current %d, next %d)",
        weekn, currentAsW, currentNextW);

    const filter = buildFilter(weekn);
    const content = await getData(filter);
    const redacted = _.compact(_.map(content, function(e) {

        const r = _.omit(e,
            ['savingTime', 'meaningfulId', 'hrefs',
            'images', 'pseudo', 'userId', 'when', 'nature', '_id' ]);

        r.images = _.filter(e.images, function(img) {
            if(img.linktype !== 'cdn')
                return false;
            if(_.startsWith(img.src, "https://static.xx.fbcdn.net"))
                return false;
            if(img.height == "16" && img.width == "16")
                return false;
            return true;
        });
        r.images = _.map(r.images, 'src');

        try {
            const p = _.filter(e.meaningfulId.local, {fblinktype: 'profile'});
            if(_.size(p))
                r.profiles = [];
            _.each(p, function(problock) {
                let proflink = 'https://www.facebook.com/' + problock.profileName;
                if(r.profiles.indexOf(proflink) == -1)
                    r.profiles.push(proflink);
            });
        } catch(error) {}

        try {
            const ext = _filter(e.hrefs, {linktype: 'external'});
            if(_.size(ext))
                r.links = [];
            _.each(ext, function(exblock) {
                let elink = decodeURIComponent(
                    new URL(exblock.href).search
                ).replace(/\?u=/, '').replace(/\?.*/,'')
                if(r.links.indexOf(elink) == -1)
                    r.links.push(elink);
            })
        } catch(error) {}

        return r;
    }));
    return { json: redacted };
};

async function advstats(req) {
    // const weekn = _.parseInt(req.params.weekn);
    // const filter = buildFilter(weekn);
    const filter = { "nature.kind": 'ad' };
    const content = await getData(filter);

    const stats = _.countBy(content, 'publisherName');
    const aggro = _.reduce(stats, function(memo, amount, publisherName) {
        if(amount == 1)
            memo.once.push(publisherName);
        else if(amount == 2)
            memo.twice.push(publisherName);
        else
            memo.more[publisherName] = amount;
        return memo;
    }, {
        once: [],
        twice: [],
        more: {},
        retrieved: _.size(content),
    });
    return {json: aggro };
}

async function timedstats(req) {

    const today = moment().startOf('day').toISOString();
    const week = moment().startOf('week').toISOString();

    const filter1 = { impressionTime: { "$gte": new Date(today) } };
    const filter2 = { impressionTime: { "$gte": new Date(week) } };

    const content1 = await getData(filter1);
    const stats1 = _.countBy(content1, 'nature.kind');

    const content2 = await getData(filter2);
    const stats2 = _.countBy(content2, 'nature.kind');

    return { json:
    [{
        type: 'day',
        since: today,
        amount: _.size(content1),
        typology: stats1
    }, {
        type: 'week',
        since: week,
        amount: _.size(content2),
        typology: stats2
    }] };
}

module.exports = {
    ad,
    advstats,
    timedstats,
    LIMIT,
};
