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
                lastExecution = moment().subtract(timeWindow, 'm');
            }
            debug("Looking at labels updated in the last %s", moment.duration(moment() - lastExecution).humanize() );
            return mongo
                .read(nconf.get('schema').semantics, { when: { "$gt": new Date( lastExecution.format() ) }})
                .tap(function(total) {
                    debug("we have %d semantics updated freshly", _.size(total));
                })
                .map(function(found) {
                    // debug("Found [%s] among the freshly updated semantics, looking for some feeds matching them", found.label);
                    return mongo
                        .read(nconf.get('schema').feeds, { labels: found.label });
                }, { concurrency: 1 })
                .then(_.flatten)
                .tap(function(total) {
                    debug("we have %d feed which should be updated now", _.size(total));
                })
                .map(composeXMLfromFeed, { concurrency: 1 });
        })
        .then(infiniteLoop);
};

function composeXMLfromFeed(feed) {
    /* 5 days is the window to create a newsfeed going back in time */
    const timelimit = new Date(moment().subtract(5, 'd'));
    return retrieveNewData(feed, timelimit)
        .then(function(blob) {
            return _.reduce(blob, function(memo, semanticBlock) {
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
        let info = buildMetainfo(material.metadata[i], _.size(material.label[i].l), material.label[i].textsize );
        let content = buildContent(material.metadata[i].texts, material.label[i].l );
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

    debug("retrieveNewData which is this: %j using labels %s going back until %s", feed, feed.labels, timelimit);
    
    // the goal here is to find the semanticId and then look at them in `labels` */
    return Promise.map(feed.labels, function(l) {
        return mongo
            .read(nconf.get('schema').semantics, { label: l }) // , when: { "$gt": timelimit } })
            .map(function(entry) {
                return entry.semanticId;
            })
            .tap(function(entries) {
                debug("Label %s found %d entries, timelimit %s ignored",
                    l, _.size(entries), timelimit);
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

        return _.uniq(selected);
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
    debug("Log %j", infos);
}

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

function buildMetainfo(metadata, concepts, size) {

    let attr = _.first(_.get(metadata, 'attributions')) || {};
    let details = _.get(metadata, 'linkedtime') || {};
    let pics = _.size(_.get(metadata, 'alt'));
    let date = moment(details.publicationTime);

    return {
        title: `[${details.fblinktype ? details.fblinktype : "error"}] ${attr.content ? "from [" : ""}${attr.content ? attr.content + ']' : "error]"} with ${concepts} concepts in ${size} chars`,
        permaLink: `${details.fblink ? 'https://facebook.com' : 'https://facebook.tracking.exposed'}${details.fblink ? details.fblink : "/issues"}`,
        guid: metadata.semanticId,
        publicationTime: date.isAfter( moment({ year: 2000 }) ) ? date.toISOString() : moment().toISOString()
    };
}

/*
        let content = buildContent(material.metadata[i].texts, material.label[i].l );
*/
function buildContent(texts, labels) {

    let ret = _.reduce(texts, function(memo, o) {
        memo += "→  " + o.text + "\n";
        return memo;
    }, "");

    ret += "⇉ concepts found:\n⇉ " + labels.join(', ');
    return ret;
};
