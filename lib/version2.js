var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var debug = require('debug')('api-2');
var geoip = require('geoip-native');
var os = require('os');
var disk = Promise.promisifyAll(require('diskusage'));
var jade = require('jade');
 
var mongo = require('./mongo');
var utils = require('./utils');
var error = require('./error');

var HTTPBadRequest = {
    httpcode: 400 // Bad Request, the justification to everything
};

var adminStats = function(req) {
    /* TODO auth, TODO more info */
    return publicStats(req)
        .then(function(retVal) {
            retVal.json.loadavg = os.loadavg();
            retVal.json.totalmem = os.totalmem();
            retVal.json.freemem = os.freemem();
            debug("adminStats: %j", retVal);
            return retVal;
        });
};

var publicStats = function(req) {
    debug("this is publicStats, play with some cache/weekly stats?");
    return Promise
        .all([
            mongo.count('facebook1'),
            disk.checkAsync('/')
        ]).then(function(numbers) {
            return {
                json: {
                    tlentries: numbers[0],
                    disk: numbers[1]
                }
            };
        });
};

var publicStaticFiles = function(req) {
   var existingFiles = [ personal ];
   var guarantee = existingFiles.indexOf(req.params.file);
   
   if(guarantee === -1)
      throw new Error("File not found");

   var path = __dirname + '/dist' + existingFiles[guarantee];
   debug("Requested static file %s", path);
   res.sendFile(path);
};

var postFeed = function(req) {

    var ipaddr = _.get(req.headers, "x-forwarded-for") || "127.0.0.1";
    var supportInfo = _.merge(_.get(req.body, 'from'), {
        counter: 0,
        when: moment().format()
    });
    supportInfo.id = _.parseInt(supportInfo.id);

    if(_.isNaN(supportInfo.id))
        throw new Error("Invalid user received?");

    debug("%s The feed importing starts", req.randomUnicode);

    var refreshes = _.get(req.body, ['timeline']);
    // var debugStats = _.get(req.body, ['locations']);

    if(!_.size(refreshes)) {
        debug("%s No feed timeline extractions now", req.randomUnicode);
    }

    debug("User %d supply with %d refreshes", 
          supportInfo.id, _.size(refreshes));

    return Promise
        .all([ mongo.writeMany('refresh2', refreshes),
               mongo.writeOne('supporters', supportInfo),
               utils.JSONsave('/dev/shm', 'postFeed', req.body),
               utils.JSONsave('/dev/shm', 'outPut', {
                  refreshes: refreshes,
                  ipaddr: ipaddr,
                  supportInfo: supportInfo
               })
        ])
        .then(function(results) {
            if( results[0] && results[1] ) {
                return { 'text': 'OK' };
            } else {
                debug("%j %j %j", results[0], results[1], results[2]);
                error.reportError({
                    'when': moment(),
                    'function': 'postFeed',
                    'version': 1,
                    'info': results,
                });
                throw new Error("Unknown");
            }
        });
};

var userTimeLine = function(req) {
    var profileId = _.parseInt(req.params.profileId);

    if(_.isNaN(profileId))
        throw new Error("Invalid user requested?");

    return mongo
        .read('refresh2', {})
        .then(function(coll) {
            debug("%s userTimeLine return %d refreshes", 
                req.randomUnicode, _.size(coll));
            return {
                json: colls
            };
        });
};

var getPersonal = function(req) {
    var profileId = _.parseInt(req.params.profileId);
    /* not used this variable */
    debug("%s getPersonal page", req.randomUnicode);
    return { 'file': 'personal.html' };
};

var exportNode = function(req) {
    var queryS = req.params.selector === 'all' ? {} : req.params.selector;
    debug("Selector for exportNode is: %j", queryS);
    return mongo
        .read('facebook1', queryS)
        .then(function(colls) {
            debug("export of the Node content: %d entries", _.size(colls));
            return {
                json: colls
            }
        });
};

var writeContrib = function(req) {
    debug("TODO writeContrib");
};


module.exports = {
    adminStats: adminStats,
    publicStats: publicStats,
    postFeed: postFeed,
    getPersonal: getPersonal,
    // getIndex: getIndex, // Is the same of version 1
    userTimeLine: userTimeLine,
    exportNode: exportNode,
    writeContrib: writeContrib
};
