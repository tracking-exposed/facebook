var _ = require('lodash');
var debug = require('debug')('lib:params');

function getInt(req, what) {
    var rv = _.parseInt(_.get(req.params, what));
    if(_.isNaN(rv)) {
        debug("getInt: Error with parameter [%s] in %j", what, req.params);
        return 0;
    }
    return rv;
}

function getString(req, what) {
    var rv = _.get(req.params, what);
    if(_.isUndefined(rv)) {
        debug("getString: Missing parameter [%s] in %j", what, req.params);
        return "";
    }
    return rv;
}


module.exports = {
    getInt: getInt,
    getString: getString
};
