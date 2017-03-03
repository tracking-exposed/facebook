function loadAlarms(dayback, containerId) {
    var url = '/api/v1/alarms/' + dayback;

    $.getJSON(url, function(collections) {
        /* naugthy */
        $(containerId).html('<pre>' + JSON.stringify(collections, undefined, 2) + '</pre>');
    });
}
