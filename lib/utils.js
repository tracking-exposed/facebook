var _ = require('lodash');
/* spare utility awaiting to be put in a dedicated library */

/* called as .map for every timeline entry */
var tLineContentClean = function(ce) {
    var cnte = _.omit(ce, ['utime']);
    if(!_.isUndefined(cnte['utime']))
        cnte = _.set(cnte, "etime", moment(ce.utime * 1000).format());
    if(_.isUndefined(cnte.additionalInfo))
        _.unset(cnte, 'additionalInfo');
    return cnte;
};

module.exports = {
    tLineContentClean: tLineContentClean
};
