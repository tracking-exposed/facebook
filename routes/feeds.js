const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');
const debug = require('debug')('routes:rss');
const nconf = require('nconf');
const rss = require('../lib/rss');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
 
const mongo = require('../lib/mongo');
const utils = require('../lib/utils');

/*
 * logic:
 * compute a feedId using the hash function
 * check if the query exists in mongodb://facebook/feeds
 *    if yes, check if exist an .xml file ready 
 *       if yes, return all the information
 *    if not, 
 *       add at the feed the query combo 
 *       raise exception error.message = 'queued'
 * this logic is not describing the validation made with 'labels' 
 */
function feeds(req) {

    if(!_.endsWith(req.params.query, '.xml'))
        return { text: 'expected [*.xml]' };

    const labels = req.params.query.replace(/\.xml$/, '').split('+').sort();
    debug("Requested RSS feed by [%s]", labels.join(', '));
    const feedId = utils.hashList(labels);

    return rss.validateFeed(labels)
        .then(function() {
            return rss.rssRetriveOrCreate(labels, feedId);
        })
        .then(function(feed) {
            let sourceF = path.join(__dirname, '..', 'rss', feed.xmlpath);
            return fs
                .readFileAsync(sourceF, 'utf-8')
                .then(function(content) {
                    debug("read %d bytes from %s, serving it back", _.size(content), feed.xmlpath);
                    return { text: content };
                });
        })
        .catch(function(error) {
            /* this error message is fired by rssRetrieveOrCreate, happens
             * when a XML file do not exists yet, but would be in few minutes */
            if(error.message === rss.QUEUED_STRING) {
                debug("Returning default message for %s", labels);
                return { 'text': rss.produceDefault(labels, feedId) };
            }
            /* this error message is fired by validateFeed if the labels are invalid */
            else {
                debug("Catch error message: %s", error.message);
                return { text: rss.produceError() };
            }
        });
};

module.exports = {
    feeds,
};
