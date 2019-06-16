#!/usr/bin/env node
const _ = require('lodash');
const Promise = require('bluebird');
const debug = require('debug')('algorithmchanges:source');
const moment = require('moment');
const nconf = require('nconf');

const mongo = require('../../lib/mongo');
const utils = require('../../lib/utils');

var cfgFile = "config/datathon.json";
nconf.argv().env().file({ file: cfgFile });

let cs = _.parseInt(nconf.get('chunksize'));
let first = !!nconf.get('first');

if(_.isNaN(cs)) {
	console.log("you need to specify --chunksize");
	return;
}

let utentimanifesto = [ 
        "panini-beans-manicotti", 
        "mulberry-dumplings-avocado", 
        "shawarma-yolk-cheese", 
        "churros-peach-blackberry", 
        "tortilla-eggplant-pie", 
        "peach-date-thyme", 
        "parsley-bokchoy-mustard", 
        "cobbler-blueberry-watercress", 
        "samosa-toast-baklava", 
        "apple-wheatberry-udon" 
    ];


let cache = { 'organic': {}, 'sponsored': {} };
const keys = [ 'chunksize', 'user', 'day' ,
			'sourcediv', 'advdiv', 'sourceavg', 'advavg', 'daysize' ];
return mongo
	.read('summary', { user: { $in: utentimanifesto }}, { impressionTime: 1 })
	.map(function(impression, i, full) {
		/* first: append the data if present,
		 * second: trim to 200
		 * third if > 200 -> put the metadata
		 *       if < 200 -> keep null
		 */
		impression.chunksize = cs;
		impression.day = moment(impression.impressionTime).format("YYYY-MM-DD");

		const nature = _.get(impression, 'nature');
		const user = _.get(impression, 'user');
		const source = _.get(impression, 'source');

		if(!cache[nature])
			return null;

		if(_.isUndefined(cache[nature][user]))
			cache[nature][user] = [];

		if(_.size(cache[nature][user]) == cs) {
			cache[nature][user] = _.drop(cache[nature][user], 1);
		}
		cache[nature][user].push(source);

		impression.sourcediv = 0;
		impression.sourceavg = 0;
		impression.advdiv = 0;
		impression.advavg = 0;

		if(cache.organic[user] && _.size(cache.organic[user]) == cs) {
			impression.sourcediv = _.size(_.uniq(cache.organic[user]));
			impression.sourceavg = _.round(impression.sourcediv * (100 / cs), 1);
		}
		if(cache.sponsored[user] && _.size(cache.sponsored[user]) == cs) { 
			impression.advdiv = _.size(_.uniq(cache.sponsored[user]));
			impression.advavg = _.round(impression.advdiv * (100 / cs), 1);
		}
		return impression;
	})
	.then(function(all) {
		const compa = _.compact(all)
		debug("%d lengts bewfore comppact ad %d after", _.size(all), _.size(compa));

		if(first)
			console.log(_.join(keys, ','));

		return _.compact(_.flatten(_.map(_.groupBy(compa, 'user'), function(personal, user) {
			if(!_.size(personal))
				return [];
			return _.flatten(_.map(_.groupBy(personal, 'day'), function(daily, day) {
				if(!_.size(daily))
					return [];
				return _.extend(_.last(daily), { daysize: _.size(daily) });
			}));
		})));
	})
	.map(function(impress) {
		return _.pick(impress, keys);
	})
	.map(function(impre) {
		let line = ""
		_.each(keys, function(k, i ) {
			line += impre[k];
			if(_.size(keys) -1 != i)
				line +=","
		})	
		console.log(line);
	})
	.catch(function(error) {
		console.log(error);
		debugger;
		throw error;
	})

function howMany(lst) {
    debug("There are %d objects", _.size(lst));
};

function writeNewPseudos(supporter) {

    supporter.pseudo = utils.pseudonymizeUser(supporter.userId);
    return mongo
        .updateOne(nconf.get('schema').supporters, { _id: supporter._id }, supporter);
};