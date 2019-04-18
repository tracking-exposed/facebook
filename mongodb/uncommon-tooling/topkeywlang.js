const _ = require('lodash');
const mongo = require('./lib/mongo');

const debug = require('debug')('M');
const nconf = require('nconf');
const cfgFile = "config/content.json";
nconf.argv().env().file({ file: cfgFile })

map = [ { cc: 'dk', name: 'Denmark' },
  { cc: 'ma', name: 'Morocco' },
  { cc: 'it', name: 'Italy' },
  { cc: 'es', name: 'Spain' },
  { cc: 'gr', name: 'Greece' },
  { cc: 'de', name: 'Germany' },
  { cc: 'ch', name: 'Switzerland' },
  { cc: 'fr', name: 'France' },
  { cc: 'gb', name: 'United Kingdom' },
  { cc: 'sk', name: 'Slovakia' },
  { cc: 'cz', name: 'Czech Republic' },
  { cc: 'be', name: 'Belgium' },
  { cc: 'ro', name: 'Romania' },
  { cc: 'hu', name: 'Hungary' },
  { cc: 'pl', name: 'Poland' },
  { cc: 'ie', name: 'Ireland' },
  { cc: 'nl', name: 'Netherlands' },
  { cc: 'pt', name: 'Portugal' },
  { cc: 'se', name: 'Sweden' },
  { cc: 'no', name: 'Norway' },
  { cc: 'lt', name: 'Lithuania' },
  { cc: 'fi', name: 'Finland' },
  { cc: 'at', name: 'Austria' },
  { cc: 'mt', name: 'Malta' },
  { cc: 'hr', name: 'Croatia' },
  { cc: 'cy', name: 'Cyprus' },
  { cc: 'bg', name: 'Bulgaria' },
  { cc: 'me', name: 'Montenegro' },
  { cc: 'lv', name: 'Latvia' },
  { cc: 'ee', name: 'Estonia' } ];


return mongo.distinct('semantics', 'lang')
    .map(function(lang) {
        return mongo
            .readLimit(nconf.get('schema').semantics, { lang: lang}, { when: -1}, 5, 0)
            .then(function(entries) {
                if(!entries || !entries[0])
                    return null;

                var country =  _.find(map, { cc: entries[0].lang} );
                if(!country) {
                    debug("missing country code / lang %s", entries[0].lang);
                    return null;
                }

                return _.reduce(entries, function(memo, e) { 
                    memo.labels.push(e.label);
                    return memo;
                }, {
                    lang,
                    country: country.name,
                    labels: [],
                    total: 100
                });
            });
    }, { concurrency : 1 })
    .then(_.compact)
    .then(function(x) {
        console.log(JSON.stringify(x, undefined, 2));
    });
