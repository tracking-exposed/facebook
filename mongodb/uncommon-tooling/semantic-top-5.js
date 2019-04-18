langs = db.semantics.distinct('lang');

map = 
[ { cc: 'dk', name: 'Denmark' },
  { cc: 'it', name: 'Italy' },
  { cc: 'es', name: 'Spain' },
  { cc: 'gr', name: 'Greece' },
  { cc: 'de', name: 'Germany' },
  { cc: 'fr', name: 'France' },
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

ret = langs.forEach(function(lang) {

    x = db.semantics.aggregate([{ $match: { lang: lang}}, { $project: { "lang": true, "title": true, "_id": false} } ]);
    if(x.hasNext()) {
        printjson(x.next());
    }
});

