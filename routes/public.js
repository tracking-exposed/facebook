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
const STARTDATE = "2020-12-28";
const AMOUNT = 300;

async function getData(filter, amount, skip, special) {
    const mongodriver = await mongo3.clientConnect({concurrency: 1});
    /* publisher, text, link-to-image, paadcID, 
        savingTime, timelineId, impressionOrder, semanticID) */
    const content = await mongo3.readLimit(mongodriver, nconf.get('schema').metadata,
        filter, { impressionTime: 1 }, amount || LIMIT, skip || 0
    );

    /* if 'special' is set, this function change return type */
    if(special) {
        const total = await mongo3.count(mongodriver, nconf.get('schema').metadata,
            { "nature.kind": "ad", impressionTime: { "$gte": new Date(STARTDATE)}}
        );
        const full = await mongo3.count(mongodriver, nconf.get('schema').metadata,
            { impressionTime: { "$gte": new Date(STARTDATE)}}
        );
        // because I don't want to open a new mongodbconnect in the route, was it better 
        // to use this when is available here in getData, even if this scream fuck MONAD
        // with just one argument and one meaning. dah.
        await mongodriver.close();
    	debug("getData (special): DB return %d elements (filter %j) amount %d skip %d (total: %d)",
        	_.size(content), filter, amount || LIMIT, skip || 0, total);
        return { full, total, results: content }; // even variables change name to be sure you read this
    }
    debug("getData: DB return %d elements (filter %j) amount %d skip %d",
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
    debug("AD weekly access. Requested %d, Current %d, Next %d",
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
    if(_.isNaN(offset))
        return { text: 'You should specify a numeric offset! /api/v2/zero/$offset'};
    const filter = {
        "nature.kind": 'ad',
        impressionTime: { "$gte": new Date(STARTDATE) }
    };
    const dbdata = await getData(filter, AMOUNT, offset, true); // last param is 'special'
    debug("Zero: retrieved %d ad (total avail %d), offset %d — first %s last %s",
        _.size(dbdata.results), dbdata.total, offset,
        _.first(dbdata.results).impressionTime, _.last(dbdata.results).impressionTime );
    const clean = _.map(dbdata.results, function(e) {
        return _.omit(e, ['pseudo','userId','when']);
    })
    return { json: {
        totalAvailable: dbdata.total,
        returned: _.size(clean),
        offset,
        requestedAmount: AMOUNT,
        start: STARTDATE,
        content: clean 
    }};
}

const fbapi = [];
function initializeFbAPINames() {
    const fs = require('fs');
    const fbnames = JSON.parse(fs.readFileSync('./routes/political_advertisers.json'));
    _.each(fbnames, function(page) {
        const cleanpage = {
            page_name: page.page_name,
            page_id: page.page_id,
            url_segment: page.merge_name,
            category: page.category,
            macro: page.category2,
	    party: page.party,
        };
        fbapi.push(cleanpage);
    });
    debug("Loaded %d political advertisers", _.size(fbapi));
}

async function uno(req) {

    if(!fbapi.length) initializeFbAPINames();

    const UNOAMOUNT = 500;
    const offset = _.parseInt(req.params.offset);
    if(_.isNaN(offset))
        return { text: 'You should specify a numeric offset! /api/v2/zero/$offset'};

    const filter = {
        impressionTime: { "$gte": new Date(STARTDATE) }
    };

    const dbdata = await getData(filter, UNOAMOUNT, offset, true); // last param is 'special'
    if(dbdata.results.length) {
        debug("Uno — retrived %d ad|post (total avail %d), offset %d — first %s last %s",
            _.size(dbdata.results), dbdata.total, offset,
            _.first(dbdata.results).impressionTime, _.last(dbdata.results).impressionTime );
    } else {
        debug("Uno — no results with offset %d", offset);
    }

    const clean = _.compact(_.map(dbdata.results, function(e) {

        // 'Gesponsord' and/or 'Betaald door' in the texts metadata
        const dutchWords = ['Gesponsord', 'Betaald door'];
        const textmatch = _.first(e.texts) ?
            _.startsWith(_.first(e.texts), dutchWords[0]) :
            false;
        if(textmatch) {
            e.nature.kind = 'ad';
            e.nature.type = 'text match';
            e.nature.match = _.first(e.texts);
        }

        const match = _.find(fbapi, { 'page_name': e.publisherName });
        if(match) {
            e.nature.ispolitical = true;
            _.assign(e.nature, match);
        } else {
            e.nature.ispolitical = false;
        }

        if(!match && e.nature.kind == 'post')
            return null;

        return _.omit(e, ['pseudo','userId','when']);
    }));
    if(!clean.length)
        debug("From %d posts, now %d are adv", _.size(dbdata.results), _.size(clean));

    debug(_.countBy(clean, 'nature.type'), _.countBy(clean, 'nature.ispolitical'));
    return { json: {
        originalTotalAdvs: dbdata.total,
        fullPostAvail: dbdata.full,
        consideredPosts: _.size(dbdata.results),
        returned: _.size(clean),
        offset,
        requestedAmount: UNOAMOUNT,
        start: STARTDATE,
        content: clean,
        last: _.last(clean) ? _.last(clean).impressionTime : null,
    }};
}

module.exports = {
    ad,
    advstats,
    paadcStats,
    LIMIT,
    zero,
    uno,
};
