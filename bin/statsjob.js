const Promise = require('bluebird');
const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('bin:statsjob');

const nconf= require('nconf');

const aggregated = require('../lib/aggregated');
const mongo = require('../lib/mongo2');
const utils = require('../lib/utils');

/*
const echoes = require('../lib/echoes');
echoes.addEcho("elasticsearch");
echoes.setDefaultEcho("elasticsearch");
 */
nconf.argv().env().file({ file: 'config/statsjob.json' });
const tables = nconf.get('tables');
aggregated.hourData()

// offset is used only in development/debugging 
// it is especially meaningful when database is not updated 
// on the last day, so you can specify a number of days to look back.
const offset = utils.parseIntNconf('offset', 0);
// default days number: 15
const days = utils.parseIntNconf('offset', 15);
console.log(DAYS);

const rules = nconf.get('stats');

const hoursmap = _.times(24 * days, function(i) {
    return aggregated
        .hourData( moment().subtract(offset, 'day').subtract(i, 'hours') );
});

const results = _.map(rules, function(rule) {
    console.log(`Processing Checking ${rule.name}`);

    let specific = _.map(rule.kinds, function(k) {
       
        debug("Processing %s (%s)", rule.name, k.name );
        let content = _.map(hoursmap, function(hinfo) {
            /* execute the sequence, should be split in await/async */
            return await statsseq(rule, hinfo, k);
        })
        let total = await statsseq
    });
    return { specific, name: rule.name };
});

function statsseq(rule, hinfo, kind) {
    /* rule:
      { name: "timelines", column, timevar, kinds ... ,
       hinfo:
      { hourOnly: 2019-06-11T09:00:00.000Z,
        hourId: 'd84f8fec9366fa63fe930c40aa63650820039c8d',
        reference: '2019-06-11 11:00:00',
        m: moment("2019-06-11T11:17:37.460") },
       kind:
      { name: 'newsfeed',
        selector: { nonfeed: { '$exists': false } } 
      }                                                         */
    let matchf = _.set({}, '$' + rule.timevar, {
        $lt: new Date(hinfo.hourOnext),
        $gt: new Date(hinfo.reference)
    })
    matchf = _.extend(matchf, kind.selector);
    debug("%j", matchf)
    return mongo.aggregate(rule.column, [
        { $match: matchf },
    ])
}

/*
- prendi il tot di ore da guardare 
- calcolare le hourId
- fa upsert
- cicla sulle colonne da calcolare

timelines feed 
impressions private or not 
htmls2: processed or not
metadata: niente. si conteggia status
"attributions" : 1,
"commentable" : 1,
"adinfo" : 0,
"texts" : 0,
"externalLinks" : 0,
"commentsLinks" : 0,
"linkontime" : 1,
"alt" : 1,
"reasons" : 0,
"sharer" : 0,
"sharedContent" : 0

accesses2: distinct su ccode
summary: distinct su user

[
	"accesses2",
	"alarms",
	"entities",
	"feeds",
	"finalized",
	"haha",
	"htmls2",
	"impressions2",
	"labels",
	"metadata",
	"opendata1",
	"parsererrors",
	"parserstats",
	"performa",
	"reality",
	"semantics",
	"summary",
	"summaryCopy",
	"supporters2",
	"timelines2"
]

--- NON salvare mai le cose a 0.

*/