var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('lib:integration');
var nconf = require('nconf');
 
var mongo = require('./mongo');

var last = null;

function getTimings() {

    var sharedFields = ['permaLink', 'source', 'text', 'impressionId', 'id', 'savingTime', 'feedBasicInfo' ];

    if( req.params.key !== nconf.get('password') ) {
        debug("Integration auth failure, password mismatch");
        return { text: "key error" };
    }

    var now = _.parseInt(req.params.seconds);
    if(_.isNaN(now)) {
        now = moment().utc().unix();
        debug("Sanity check fail [%s], forced now at %s %s",
            req.params.seconds,
            now,
            moment.unix(now)
        );
    }

    if(_.isNull(last)) {
        last = moment()
                .subtract(3, 'minutes')
                .unix();
        debug("because `last` is null, is configured to check three minutes ago: %s",
            moment.unix(last).utc()
        );
    }

    if(moment.unix(last).isBefore(moment.utc().subtract(1, 'hour'))) {
        debug("because the `last is too old (%s), will be forced to 1 hour ago",
            moment.unix(last).utc()
        ); 
        last = moment().subtract(1, 'hour').unix();
        debug("and now is: %s", moment.unix(last).utc() );
    }
}

function updateLastActivity(username) {
    last = now;
}


function passwordCheck(offered) {

    var keys = nconf.get('password');

    if(_.isString(keys)) {
        debug("Password is still a string, should become a dictionary");
        return ( offered === nconf.get('password') )
    } else {
        var entry = _.find(keys, { password: offered});
        if(_.isUndefined(entry))
            return false;
        else
            return entry.username;
    }
}

function exportText(req) {

    var sharedFields = ['permaLink', 'source', 'text', 'impressionId', 'id', 'savingTime', 'feedBasicInfo' ];

    var username = passwordCheck(req.params.key);
    if(!username)
        return { 'text': 'Invalid key or users not found' };

    var timings = getTimings(username);

    var filter = {
        "text": { "$exists": true },
        savingTime: {
            "$gte": new Date(timings.last * 1000),
            "$lte": new Date(timings.now * 1000)
        }
    };

    updateLastActivity(username);

    return mongo
        .read(nconf.get('schema').htmls, filter)
        .map(function(html) {
            return _.pick(html, sharedFields);
        })
        .map(function(info) {
            info.visibility = "public";
            return info;
        })
        .then(function(infos) {
            debug("with filter %j are returned %d impressions", filter, _.size(infos));
            return { json: infos };
        });

};

module.exports = {
    exportText: exportText,
};
