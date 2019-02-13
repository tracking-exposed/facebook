const Promise = require('bluebird');
const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('lib:rss');
const nconf= require('nconf');
const RSS = require('rss');
const path = require('path');
const fs = Promise.promisifyAll(require('fs'));

const utils = require('../lib/utils');
const echoes = require('../lib/echoes');
const mongo = require('../lib/mongo');

const QUEUED_STRING = "queued";

function composeXMLfromFeed(feed) {
    /* 5 days is the window to create a newsfeed going back in time */
    const timelimit = new Date(moment().subtract(5, 'd'));
    return retrieveNewData(feed, timelimit)
        .then(mergeSemanticLabel)
        .then(composeXML);
}


function mergeSemanticLabel(blob) {
    debug("mergeSemanticLabel for semanticId %s [%d] metadata, [%d] labels",
        blob[2], _.size(blob[0]), _.size(blob[1]) );
    return _.reduce(blob, function(memo, semanticBlock) {
        if(semanticBlock[0].semanticId != semanticBlock[1].semanticId) {
            console.log("fatal consistency, check everything");
            console.log(semanticBlock[0], semanticBlock[1]);
            process.exit(0);
         }
         memo.counter++;
         memo.metadata.push(semanticBlock[0]);
         memo.label.push(semanticBlock[1]);
         return memo;
     }, { feed, counter: 0, metadata: [], label: [] });
};


function composeXML(material) {

    if(!material.counter)
        return;

    const title = `fbTREX ⏩ ${material.feed.labels.join(', ')}`;
    let composed = new RSS({
        title,
        description: fbtrexRSSdescription,
        feed_url: 'https://facebook.tracking.exposed/feeds',
        ttl: 60
    });

    _.times(_.size(material.label), function(i) {
        let info = buildMetainfo(material.metadata[i], _.size(material.label[i].l), material.label[i].lang, material.label[i].textsize );
        let content = buildContent(material.metadata[i].texts, material.label[i].l );
        content += "id: " + material.metadata[i].id;
        composed.item({
            title: info.title,
            description: content,
            url: info.permaLink,
            guid: info.guid,
            date: info.publicationTime,
        });
    });

    const rssOutput = composed.xml();
    material.feed.created = true;
    material.feed.xmlpath = path.join(material.feed.id[0], material.feed.id[1], `${material.feed.id}.xml`);
    const outFile = path.join(__dirname, '..', 'rss', material.feed.xmlpath);

    debug("Writing file %s about feed %j: %d chars", outFile, material.feed.labels, _.size(rssOutput));
    return fs
        .mkdirAsync( path.join(__dirname, '..', 'rss', material.feed.id[0]) )
        .catch(function() {})
        .then(function() {
            return fs
                .mkdirAsync( path.join(__dirname, '..', 'rss', material.feed.id[0], material.feed.id[1]) );
        })
        .catch(function() {})
        .then(function() {
            Promise.all([
                mongo.updateOne(nconf.get('schema').feeds, { id: material.feed.id }, material.feed),
                fs.writeFileAsync(outFile, rssOutput, { options: 'w'})
            ]);
        })
        .return({
            matches: _.size(material.label),
            chars: _.size(rssOutput)
        });
};


function retrieveNewData(feed, timelimit) {
    /* this function create the XML rss based on feed. labels */
    const DYNLIMIT = 15 * _.size(feed.labels); // number of post per label, because of AND operator, it is multiply

    // the goal here is to find the semanticId and then look at them in `labels` */
    return Promise.map(feed.labels, function(l) {
        return mongo
            .readLimit(nconf.get('schema').semantics, { label: l, when: { "$gt": timelimit } }, { when: -1}, 10, 0)
            .map(function(entry) {
                return entry.semanticId;
            })
            .tap(function(entries) {
                debug("Label [%s] found %d entries (DYNLIMIT %d)", l, _.size(entries), DYNLIMIT);
            });
    }, { concurrency: 2 })
    .then(function(mixed) {
        let selected;

        if(_.size(mixed) > 1) {
            /* merge time! if we've more than one label request, 
             * only the semanticId of both would be kept */
            selected = _.intersection.apply(_, mixed);
            debug("%d labels found: %j semanticId, shared among them %d",
                _.size(mixed), _.map(mixed, _.size), _.size(selected));
        }
        else
            selected = _.first(mixed);

        let uniqSemanticIds = _.uniq(selected);
        debug("Selected %d unique semanticId to rebuild the feed", _.size(uniqSemanticIds));
        return uniqSemanticIds;
    })
    .map(function(semanticId) {
        /* 
         * TODO improve the selection and intersection, having the metadata, we can 
         * filter by size of texts too */
        return Promise.all([
            mongo.readOne(nconf.get('schema').metadata, {
                semanticId: semanticId,
                semantic: {
                    "$gt": new Date("2018-01-01")
                }
            }),
            mongo.readOne(nconf.get('schema').labels, {
                semanticId: semanticId
            }),
            semanticId
        ])
    }, { concurrency: 1});
};


function buildMetainfo(metadata, concepts, lang, size) {
    let attr = _.first(_.get(metadata, 'attributions')) || {};
    let details = _.get(metadata, 'linkedtime') || {};
    let pics = _.size(_.get(metadata, 'alt'));
    let date = moment(details.publicationTime);

    return {
        title: `[${details.fblinktype ? details.fblinktype : "error"}] lang [${lang}] ${attr.content ? "from [" : ""}${attr.content ? attr.content + ']' : "error]"} with ${concepts} concepts in ${size} chars`,
        permaLink: `${details.fblink ? 'https://facebook.com' : 'https://facebook.tracking.exposed'}${details.fblink ? details.fblink : "/issues"}`,
        guid: metadata.semanticId,
        publicationTime: date.isAfter( moment({ year: 2000 }) ) ? date.toISOString() : moment().toISOString()
    };
}


function buildContent(texts, labels) {
    let ret = _.reduce(texts, function(memo, o) {
        memo += CR + " → " + o.text;
        return memo;
    }, "");

    ret += CR + "⇉ concepts found:⇉ " + CR + labels.join(', ');
    ret += CR + CR + "-- " + CR

    return ret;
};

const CR = '<![CDATA[<br/>]]>';
const fbtrexRSSplaceholder = "Welcome, you should wait 10 minutes circa to get this newsfeed populated, now the subscription is taken in account. " + CR + "fbTREX would stop to populate this feed if no request is seen in 5 days. updates would be automatic. You can find more specifics about the RSS settings in [here todo doc]";
const fbtrexRSSdescription = "This newsfeed is generated by the distributed observation of Facebook posts, collected with https://facebook.tracking.exposed browser extension; The posts are processed with a technical proceduce called semantic analysis, it extract the core meanings of the post linkable to existing wikipedia pages";
const fbtrexRSSproblem = "We can't provide a newsfeed on the information you requested. This is, normally, due because you look for a keyword which has not been seen recently. We permit to generate RSS only about voices which are part of wikipedia because this ensure we do not enable any kind of stalking. (editing wikipedia would not work). You can really use only label which are meaningful encyclopedic voices.";

function validateFeed(labels) {
    /* please remind, if semantics has some expire configure,
     * should be at at least 30 days ? */
    return Promise.map(labels, function(l) {
        return mongo
            .count(nconf.get('schema').semantics, { label: l })
            .then(function(amount) {
                if(!amount)
                    throw new Error("invalid label request");
            });
    });
}

function rssRetriveOrCreate(labels, feedId) {

    return mongo
        .readOne(nconf.get('schema').feeds, { id: feedId, created: true })
        .then(function(feed) {
            /* label are valid combo, but do not exist */
            if(!feed || !feed.xmlpath) {
                debug("Registering feed %s for %j", feedId, labels);
                return mongo
                    .writeOne(nconf.get('schema').feeds, {
                        id: feedId,
                        insertAt: new Date(),
                        labels: labels,
                        created: false
                    })
                    .catch(function(error) {
                        if(error.code === 11000) {
                            debug("The feed %s already existing but not yet render", error.message);
                            throw new Error(QUEUED_STRING);
                        }
                        debug("Unexpected error [%s] forwarding up", error);
                        throw error;
                    })
                    .then(function() {
                        debug("The feed is queued now");
                        throw new Error(QUEUED_STRING);
                    });
            } else {
                debug("Labels %j follow on: %j", labels, feed.xmlpath);
                return feed;
            }
        });
};

function produceDefault(labels, feedId) {

    let feed = new RSS({
        title: `fbTREX ⏩ ${_.first(labels)}`,
        description: fbtrexRSSdescription,
        feed_url: 'https://facebook.tracking.exposed/feeds/',
        ttl: 60
    });
    feed.item({
        title: `fbTREX would provide update soon...`,
        description : fbtrexRSSplaceholder + "\n" + fbtrexRSSdescription,
        guid: feedId,
        date: moment().startOf('year').toISOString()
    });
    return feed.xml();
};

function produceError() {

    let feed = new RSS({
        title: `fbTREX Ⓧ  Error!?`,
        description: 'There is an error in your requested feed',
        feed_url: 'https://facebook.tracking.exposed/feeds/problems',
        ttl: 20
    });
    feed.item({
        title: `fbTREX Ⓧ  Invalid label!?`,
        description : fbtrexRSSproblem,
        guid: _.random(0, 0xffff),
        date: moment().toISOString()
    });
    return feed.xml();
};


module.exports = {
    /* used by buildrsserv */
    composeXMLfromFeed: composeXMLfromFeed,
    retrieveNewData: retrieveNewData,
    mergeSemanticLabel: mergeSemanticLabel,
    composeXML: composeXML,

    /* Strings */
    fbtrexRSSplaceholder: "Welcome, you should wait 10 minutes circa to get this newsfeed populated, now the subscription is taken in account. " + CR + "fbTREX would stop to populate this feed if no request is seen in 5 days. updates would be automatic. You can find more specifics about the RSS settings in [here todo doc]",
    fbtrexRSSdescription: "This newsfeed is generated by the distributed observation of Facebook posts, collected with https://facebook.tracking.exposed browser extension; The posts are processed with a technical proceduce called semantic analysis, it extract the core meanings of the post linkable to existing wikipedia pages",
    fbtrexRSSproblem: "We can't provide a newsfeed on the information you requested. This is, normally, due because you look for a keyword which has not been seen recently. We permit to generate RSS only about voices which are part of wikipedia because this ensure we do not enable any kind of individal stalking. (don't try to edit wikipedia, it would not work). ",
    QUEUED_STRING: QUEUED_STRING,

    /* used in /route/feeds */
    validateFeed: validateFeed,
    rssRetriveOrCreate: rssRetriveOrCreate,
    produceError: produceError,
    produceDefault: produceDefault
};
