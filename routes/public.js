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
async function getData(filter, amount, skip) {
    const mongodriver = await mongo3.clientConnect({concurrency: 1});
    /* publisher, text, link-to-image, paadcID, 
        savingTime, timelineId, impressionOrder, semanticID) */
    const content = await mongo3.readLimit(mongodriver, nconf.get('schema').metadata,
        filter, { impressionTime: 1 }, amount || LIMIT, skip || 0
    );
    debug("Returning from DB advertising %d elements (filtered as %j) amount %d skip %d",
        _.size(content), filter, amount || LIMIT, skip || 0);
    await mongodriver.close();
    return content;
}

function testHack(userId) {
    let retval = "";
    const convstr = (userId % 0xffff);
    _.times(_.size(convstr.toString()), function(i) {
        retval += convstr.toString().charCodeAt(i);
    });
    return retval.substr(0, 9);
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

        if(e.paadc == null || e.paadc == "undefined") {
            // return null; when the TEST-PATCH is gone
            e.paadc = testHack(e.userId);
        }

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
            const ext = _.filter(e.hrefs, {linktype: 'external'});
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
    const valid = _.compact(_.map(content, function(e) {
        if(e.paadc == null || e.paadc == "undefined") {
            return null; 
        }
        return e;
    }));
    
    const stats = _.countBy(valid, 'publisherName');
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
        valid: _.size(valid)
    });
    return {json: aggro };
}

async function paadcStats(req) {

    const today = moment().startOf('day').toISOString();
    const week = moment().startOf('week').toISOString();

    const filter1 = { impressionTime: { "$gte": new Date(today) } };
    const filter2 = { impressionTime: { "$gte": new Date(week) } };

    const content1 = await getData(filter1);
    const counted1 = _.countBy(content1, 'paadc');
    const stats1 = _.countBy(content1, 'nature.kind');

    const content2 = await getData(filter2);
    const counted2 = _.countBy(content2, 'paadc');
    const stats2 = _.countBy(content2, 'nature.kind');

    return { json: 
    [{
        type: 'day',
        since: today,
        amount: _.size(content1),
        partecipants: counted1,
        partecipantNumber: _.size(counted1),
        typology: stats1
    }, {
        type: 'week',
        since: week,
        amount: _.size(content2),
        partecipants: counted2,
        partecipantNumber: _.size(counted2),
        typology: stats2
    }] };
}

async function zero(req) {
    const offset = _.parseInt(req.params.offset);
    if(!offset || _.isNaN(offset))
        return { text: 'You should specify a numberic offset!'};

    const beginning = moment("2020-12-28");
    const filter = {
        "nature.kind": 'ad',
        impressionTime: { "$gte": new Date(beginning.toISOString()) }
    };
    const results = await getData(filter, 300, offset);

    debug("Retrieved %d from zero, with offset %d, a first %s last %s - from %s",
        offset, _.first(results).impressionTime, _.last(results).impressionTime );
    const clean = _.map(results, function(e) {
        return _.omit(e, ['pseudo','userId','when']);
    })
    return { json: clean };
}

module.exports = {
    ad,
    advstats,
    paadcStats,
    LIMIT,
    zero,
};
