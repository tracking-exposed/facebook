#!/usr/bin/env node
var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));
var nconf = require('nconf');
var debug = require('debug')("dandelion");
var mongo = require('../lib/mongo');
var various = require('../lib/various');

nconf.argv().env();
nconf.file('settings', { file: './config/settings.json' });

function composeNEX(fbtrexobj) {
    var content = {
        id: various.hash({
            'href': fbtrexobj.link,
            'type': "original",
        }),
        original: fbtrexobj.link,
        publicationTime: new Date(fbtrexobj.putime)
    };
    return mongo
        .read("entities", { id: content.id })
        .then(function(exists) {
            if(_.get(exists[0], 'id')  === content.id)
                return null;
            return content;
        });
}

function saveJSON(content) {
    if(!content || !content.id) return;
    return mongo.save("entities", content);
}

var tokenTrackers = _.map(nconf.get("dandelion"), function(token) {
    return {
        unitsLeft: 1000,
        token: token
    };
});

function getToken() {

    var token = _.find(tokenTrackers, function(o) {
        return o.unitsLeft > 10;
    }).token;

    if(_.isUndefined(token)) {
        console.log("Error, token exhausted %j", tokenTrackers);
        process.exit(0);
    }
    debug("token status: %j", _.map(tokenTrackers, 'unitsLeft'), token);
    return token;
};

function recordTokenUsage(token, unitsLStr) {

    var ul = _.parseInt(unitsLStr)

    if(!ul) {
        debug("Error with the last session: units not consumed?");
        return;
    }

    var e = _.find(tokenTrackers, { token: token });
    e.unitsLeft = ul;
    tokenTrackers = _.orderBy(tokenTrackers, 'unitsLeft', 'desc');

/*
            if(_.parseInt(response.headers['x-dl-units-left']) < 2) {
                console.log("Units terminated, key", nconf.get('key'));
                process.exit(0);
            }
*/
}


function dandelion(partialo) {
    var begin = moment();
    var token = getToken();
    return request.postAsync(
        "https://api.dandelion.eu/datatxt/nex/v1/",
        { form: {
            token: token,
            url: partialo.original
        } }
        ).then(function (response, body) {
            // response.headers['x-dl-units-reset']
            debug("Tested %s, published %s (%s) units left %d",
                    partialo.original,
                    moment(partialo.publicationTime).format(),
                    moment.duration(moment() - moment(partialo.publicationTime)).humanize(),
                    response.headers['x-dl-units-left']);

            recordTokenUsage(token, response.headers['x-dl-units-left']);
            return _.extend(partialo, JSON.parse(response.body));
        })
        .catch(function(error) {
            debug("Error with %s: %s", partialo.original, error);
            return null;
        })
        .then(function(e) {
            /* debug("Dandelion get completed in %d seconds",
                moment.duration(moment() - begin).asSeconds()); */
            e.timestamp = new Date(e.timestamp);
            return e;
        })
        .then(saveJSON)
}

if(!nconf.get('api'))
    throw new Error("api");

var SERVER_API_URL = nconf.get('api');
debug("API endpoint %s", SERVER_API_URL);

var bigbang = moment();
return various
    .loadJSONurl(SERVER_API_URL)
    .then(function(ret) {
        var urls = ret.results;
        debug("retrieved %d urls %s", _.size(urls), ret.queryInfo.times);
        return urls;
    })
    .map(composeNEX, { concurrency: 1 })
    .then(_.compact)
    .then(_.orderBy({ publicationTime: 1 }))
    .tap(function(xxx) {
        var ranked = _.countBy(xxx, function(x) {
            return moment.duration(moment() - moment(x.publicationTime)).humanize();
        });
        debug("new urls %d, in %d seconds, this time distribution: %s", _.size(xxx),
            moment.duration(moment() - bigbang).asSeconds(), JSON.stringify(ranked, undefined, 2));
    })
    .map(dandelion, { concurrency: 1 })
    .tap(function(xxx) {
        debug("Fetched %d resources in %d seconds", _.size(xxx),
            moment.duration(moment() - bigbang).asSeconds());
    });
