var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('lib:performa');
var nconf = require('nconf');

var mongo = require('./mongo');

var queue = [];

function begin(fname, cname, info) {
    var now = moment();
    var p = {
        fname: fname,
        cname, cname,
        info: JSON.stringify(info),
        start: now.unix() * 1000 + now.milliseconds(),
        when: new Date()
    };
    debug("Queue size %d +pushing %s %s",
        _.size(queue), p.fname, p.cname);
    queue.push(p);
    return p;
};

function complete(performaBj) {
    var now = moment();
    var end = now.unix() * 1000 + now.milliseconds();
    var p = _.find(queue, { start: performaBj.start });
    p.end = end;
    p.msdiff = p.end - p.start;
    debug("Completed %s in %s [ms %d]", p.fname, p.cname, p.msdiff);
};

module.exports = {
    begin: begin,
    complete: complete,
    queue: queue
};
