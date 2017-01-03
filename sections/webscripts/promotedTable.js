function loadLastFourPromoted(containerId) {
    var url = '/api/v1/promoted/4'

    $.getJSON(url, function(collections) {

        /* convert collections with basic shape explained here 
         * https://datatables.net/manual/data/ */
        var converted = _.map(collections, function(infob) {
            return _.values(infob)
        });

        $(containerId).DataTable( {
            data: converted
        });
    });
};
