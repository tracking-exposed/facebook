function initializeSummary() {
    const token = _.find(window.location.pathname.split('/'), function(e) {
        return _.size(e) == 40;
    });
    $('#summary').text(`${window.location.origin}/api/v1/summary/${token}`);
};
