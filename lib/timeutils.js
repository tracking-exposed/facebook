var _ = require('lodash');
var debug = require('debug')('timeutils');
var moment = require('moment');
var utils = require('./utils');

var beginOf = "2016-12-09"

function prettify(timeS) {
    var S = moment(timeS.start);
    var E = moment(timeS.end);
    return S.format("DD/MM HH") + " → " +
        E.format("DD/MM HH") + " [" +
        moment.duration(E - S).humanize() + "] ";
};

function doFilter(hoursAfter, daysAgo, hoursAgo, amount, unit) {

  hoursAfter = hoursAfter ? _.parseInt(hoursAfter) : 0;
  daysAgo = daysAgo ? _.parseInt(daysAgo) : 0;
  hoursAgo = hoursAgo ? _.parseInt(hoursAgo) : 0;

  debugger;
  if(hoursAfter && (daysAgo || hoursAgo))
      throw new Error("HOURSAFTER and DAYSAGO+HOURSAGO are mutually exclusive");

  if(!(hoursAfter || daysAgo || hoursAgo))
      throw new Error("HOURSAFTER and DAYSAGO+HOURSAGO at least one has to be > 0");

  var start, end;

  if(hoursAfter) {
      start = moment(beginOf)
          .add(hoursAfter, 'h')
          .format("YYYY-MM-DD HH:00:00");
      end = moment(beginOf)
          .add(hoursAfter, 'h')
          .add(amount, unit)
          .format("YYYY-MM-DD HH:00:00");
  } else {
      start = moment()
          .subtract(daysAgo, 'd')
          .subtract(hoursAgo, 'h')
          .subtract(amount, unit)
          .format("YYYY-MM-DD HH:00:00");
      end = moment()
          .subtract(daysAgo, 'd')
          .subtract(hoursAgo, 'h')
          .format("YYYY-MM-DD HH:00:00");
  }

  if(moment().isBefore(start))
      throw new Error("you're asking to go in the future! " + start);

  var id = moment.duration(moment(start) - moment(beginOf) ).asHours();
  debug("computed filter for %s → %s ID %d window[%d %s]",
      start, end, id, amount, unit);

  return { 
    start: start, 
    end: end,
    id: id
  };
};

module.exports = {
    doFilter: doFilter,
    prettify: prettify
};
