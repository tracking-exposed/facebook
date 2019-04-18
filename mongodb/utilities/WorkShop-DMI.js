const various = require('./lib/various');
const _ = require('lodash');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const moment = require('moment');

const users = {
    "Mia": "90",
    "Maria": "73",
    "Roos": "61",
    "Bernard": "62"
};

const known = [ 
    "Cristiano Ronaldo",
    "Real Madrid C.F.",
    "FC Barcelona",
    "Shakira",
    "Tasty",
    "YouTube",
    "Mr Bean",
    "Leo Messi",
    "Mia Emsley",
    "Roos Bakker",
    "Maria Visser",
    "Bernard Hanks",
    "Anti EU - Pro British",
    "I Support Brexit",
    "Get Britain Out",
    "Leave.EU"
];

const anti = [
    "Anti EU - Pro British",
    "I Support Brexit",
    "Get Britain Out",
    "Leave.EU"
];

var out = 'output-3.csv';

return various.loadJSONfile('all.json')
    .then(function(data) {
        return data.results;
    })
    .map(function(data, ndx) {
        
        var profileName = _.reduce(users, function(memo, ending, name) {
           
            if(_.endsWith(data.userId + "", ending))
                memo = name;
            return memo;
        }, null);

        if(!profileName)
            debugger;

        var retval = _.pick(data, ['timelineId', 'impressionOrder', 'commentable', 'id'] );

        if(!data.attributions[0] || data.attributions[0].type != "authorName")
            debugger;

        if ( known.indexOf(data.attributions[0].content) === -1 )
            retval.followed = false;
        else
            retval.followed = true;

        retval.anti = (anti.indexOf(data.attributions[0].content) === -1);
        retval.postId = data.linkedtime.postId;
        retval.link = 'https://facebook.com/' + data.linkedtime.postId;
        retval.source = data.attributions[0].content;
        retval.display = data.attributions[0].display;
        retval.profileName = profileName;
        retval.timelineId = data.timelineId;
        retval.impressionTime = moment(data.impressionTime).add(1, 'h').toISOString();
        return retval;
    })
    .tap(function(clean) {
        return fs.writeFileAsync(out, convertCSV(clean));
    })
    .tap(function(clean) {
        console.log(`Generated ${_.size(clean)} in ${out}`);
    });


function convertCSV(data) {
    var result, ctr, keys, columnDelimiter, lineDelimiter;

    columnDelimiter = ',';
    lineDelimiter = '\n';

    keys = Object.keys(data[0]);

    result = '';
    result += keys.join(columnDelimiter);
    result += lineDelimiter;

    data.forEach(function(item) {
        ctr = 0;
        keys.forEach(function(key) {
            if (ctr > 0) result += columnDelimiter;

            result += '"' + item[key] + '"';
            ctr++;
        });
        result += lineDelimiter;
    });

    return result;
}
