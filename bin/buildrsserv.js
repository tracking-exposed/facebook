const Promise = require('bluebird');
const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('bin:buildrsserv');
const nconf= require('nconf');
const RSS = require('rss');
const path = require('path');
const fs = Promise.promisifyAll(require('fs'));
nconf.argv().env().file({ file: 'config/content.json' });

const utils = require('../lib/utils');
const echoes = require('../lib/echoes');
const mongo = require('../lib/mongo');
const fbtrexRSSdescription = require('../lib/rss').fbtrexRSSdescription;

/* configuration for elasticsearch */
echoes.addEcho("elasticsearch");
echoes.setDefaultEcho("elasticsearch");

const FREQUENCY = 10;
const timeWindow = _.parseInt(nconf.get('window')) || 5; // minutes
var lastExecution = null;

console.log(`Starting periodic check, every ${FREQUENCY} seconds`);
infiniteLoop();

function infiniteLoop() {
    /* this will launch other scheduled tasks too */
    return Promise
        .resolve()
        .delay(FREQUENCY * 1000)
        /*
         * This tool look at the `feeds` for object with { created: false },
         * and creates a populated XML newsfeed with the last days of matching 
         * keywords.
         * If success, mark the semantic with a new date, if fail, mark it with "false".
         */
        .then(getFreshlySubscribed)
        .map(composeXMLfromFeed, { concurrency: 1 })
        .tap(logCreations)
        .delay(FREQUENCY * 1000)
        /*
         * It looks at all the `labels` added since the lastExecution (and, if null
         * uses the default of the env variable "window", look if any feed match
         * with them, and update them if they do
         */
        .then(function() {

            if(!lastExecution) {
                debug("First execution, looking at %d minutes back", timeWindow);
                lastExecution = moment().subtract(timeWindow, 'm').add(moment().utcOffset, 'm');
            }
            return mongo
                .read(nconf.get('schema').semantics, { when: { "$gt": new Date( lastExecution.format() ) }})
                .tap(function(total) {
                    if(_.size(total)) {
                        debug("Looking at labels updated in the last %s: found %d",
                            moment.duration(moment() - lastExecution).humanize(), _.size(total));
                    }
                })
                .map(function(found) {
                    return mongo
                        .read(nconf.get('schema').feeds, { labels: found.label });
                }, { concurrency: 1 })
                .then(_.flatten)
                .tap(function(total) {
                    if(_.size(total))
                        debug("Found %d feeds matching with the updated `semantics`. Running update...", _.size(total));
                })
                .map(composeXMLfromFeed, { concurrency: 1 });
        })
        .tap(function() {
           debug("news+updates processed in %s", moment.duration(moment() - lastExecution).humanize() );
                lastExecution = moment().add(moment().utcOffset, 'm');
        })
        .then(infiniteLoop);
};

function composeXMLfromFeed(feed) {
    /* 5 days is the window to create a newsfeed going back in time */
    const timelimit = new Date(moment().subtract(5, 'd'));
    return retrieveNewData(feed, timelimit)
        .then(function(blob) {
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
        })
        .then(composeXML);
}

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

function getFreshlySubscribed() {
    return mongo
        .read(nconf.get('schema').feeds, { created: false });
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

function logCreations(infos) {
}
/*

function logSemanticServer(amount) {
    echoes.echo({
        index: 'semanticserv',
        amount: amount
    });
}

function elasticLog(entry, analyzed) {
    echoes.echo({
        index: 'semantics',
        semanticId: entry.semanticId,
        textsize: _.size(entry.dandelion.fulltext),
        annotations: _.size(analyzed.semantics),
        lang: analyzed.lang
    });
};

 */

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

    const CR = '<![CDATA[<br/>]]>';
    let ret = _.reduce(texts, function(memo, o) {
        memo += CR + " → " + o.text;
        return memo;
    }, "");

    ret += CR + "⇉ concepts found:⇉ " + CR + labels.join(', ');
    ret += CR + CR + "-- " + CR

    return ret;
};
