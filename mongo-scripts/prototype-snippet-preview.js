#!/usr/bin/env node
var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('prototype');
var moment = require('moment');
var nconf = require('nconf');
var fs = Promise.promisifyAll(require('fs'));

var utils = require('../lib/utils');
var mongo = require('../lib/mongo');

var cfgFile = "config/content.json";
nconf.argv().env().file({ file: cfgFile });

const TOP_KEYWORDS = 10;

return mongo
    .distinct(nconf.get('schema').labels, 'lang', { when: { "$gt" : new Date("2019-01-01") }})
    /* first, find and save top keywords per language */ 
    .map(function(language) {
        debug("testing %s", language);
        return mongo
            .aggregate(nconf.get('schema').semantics, {
                lang: language
            }, {
                _id: '$label',
                count: { $sum: 1}
            })
            .then(function(a) {
                return _.take(_.reverse(_.orderBy(a, 'count')), TOP_KEYWORDS);
            })
            .then(function(selected) {
                return _.map(selected, function(e) { return { label: e._id, count: e.count }});
            })
            .tap(function(selected) {
                return fs.writeFileAsync(
                    `topkeyws/topkeywords-${language}.json`,
                    JSON.stringify(selected, undefined, 2)
                );
            })
            .then(function(selected) {
                return {
                    language,
                    selected
                };
            });
    },{ concurrency: 1} )
    .map(function(keyws) {
        debug("processing language %s (%d top labels)", keyws.language, _.size(keyws.selected) );

        return Promise.map(keyws.selected, function(lo) {
            debug("looking for label %j", lo.label);
            return mongo
                .readLimit(nconf.get('schema').semantics, { label: lo.label }, { when: -1 }, 40, 0)
                .map(function(l) {
                    return Promise.all([
                        mongo
                            .readOne(nconf.get('schema').metadata, { semanticId: l.semanticId })
                            .then(cleanMetadata),
                        mongo.readOne(nconf.get('schema').labels, { semanticId: l.semanticId })
                    ])
                    .then(function(mix) {
                        if(!mix[0]) // return null when some metadata is missing;
                            return null;
                        return { semantic: mix[1], post: mix[0] };
                    })
                }, { concurrency: 1 })
                .then(_.compact)
                .then(function(tobes) {
                    debug("From label %s language %s, saving %d posts",
                        lo.label, keyws.language, _.size(tobes)
                    );
                    return fs.writeFileAsync(
                        `topkeyws/${keyws.language}-___${lo.label}.json`,
                        JSON.stringify(tobes, undefined, 2)
                    );

                });
        }, { concurrency: 1 });
    }, { concurrency: 1})
    .then(function(x) {
        debugger;
    });

function cleanMetadata(m) {
    try {
        if(!(
            m.attributions[0].content &&
            m.linkedtime.fblink &&
            m.linkedtime.publicationTime &&
            m.linkedtime.fblinktype &&
            m.dandelion.fulltext
        ))
            return null;
    }
    catch (error) {
        return null;
    };

    return {
        author: m.attributions[0].content,
        permalink: m.linkedtime.fblink,
        publicationTime: m.linkedtime.publicationTime,
        type: m.linkedtime.fblinktype,
        fulltext: m.dandelion.fulltext,
        links: m.externalLinks
    };
};
